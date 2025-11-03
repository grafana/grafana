package notifier

import (
	"context"
	"testing"

	"github.com/grafana/alerting/receivers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIsPlaceholderEmail(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		expected bool
	}{
		{
			name:     "placeholder with angle brackets",
			email:    "<example@email.com>",
			expected: true,
		},
		{
			name:     "placeholder without angle brackets",
			email:    "example@email.com",
			expected: true,
		},
		{
			name:     "placeholder with spaces",
			email:    "  <example@email.com>  ",
			expected: true,
		},
		{
			name:     "valid email",
			email:    "user@example.com",
			expected: false,
		},
		{
			name:     "another valid email",
			email:    "admin@grafana.com",
			expected: false,
		},
		{
			name:     "empty string",
			email:    "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPlaceholderEmail(tt.email)
			assert.Equal(t, tt.expected, result)
		})
	}
}

type mockNotificationService struct {
	sendEmailCalled bool
	lastCommand     *notifications.SendEmailCommandSync
}

func (m *mockNotificationService) SendEmailCommandHandlerSync(ctx context.Context, cmd *notifications.SendEmailCommandSync) error {
	m.sendEmailCalled = true
	m.lastCommand = cmd
	return nil
}

func (m *mockNotificationService) SendEmailCommandHandler(ctx context.Context, cmd *notifications.SendEmailCommand) error {
	return nil
}

func (m *mockNotificationService) SendWebhookSync(ctx context.Context, cmd *notifications.SendWebhookSync) error {
	return nil
}

func (m *mockNotificationService) SendResetPasswordEmail(ctx context.Context, cmd *notifications.SendResetPasswordEmailCommand) error {
	return nil
}

func (m *mockNotificationService) ValidateResetPasswordCode(ctx context.Context, query *notifications.ValidateResetPasswordCodeQuery, userByLogin notifications.GetUserByLoginFunc) (*user.User, error) {
	return nil, nil
}

func (m *mockNotificationService) SendVerificationEmail(ctx context.Context, cmd *notifications.SendVerifyEmailCommand) error {
	return nil
}

func TestEmailSender_SendEmail_PlaceholderHandling(t *testing.T) {
	tests := []struct {
		name           string
		recipients     []string
		expectSend     bool
		expectedRecips []string
		description    string
	}{
		{
			name:           "all placeholder addresses - skip gracefully",
			recipients:     []string{"<example@email.com>"},
			expectSend:     false,
			expectedRecips: nil,
			description:    "Should skip sending when all recipients are placeholders",
		},
		{
			name:           "mixed valid and placeholder addresses",
			recipients:     []string{"<example@email.com>", "user@example.com"},
			expectSend:     true,
			expectedRecips: []string{"user@example.com"},
			description:    "Should filter out placeholders and send to valid addresses",
		},
		{
			name:           "all valid addresses",
			recipients:     []string{"user@example.com", "admin@grafana.com"},
			expectSend:     true,
			expectedRecips: []string{"user@example.com", "admin@grafana.com"},
			description:    "Should send to all valid addresses",
		},
		{
			name:           "multiple placeholders with one valid",
			recipients:     []string{"example@email.com", "<example@email.com>", "valid@example.com"},
			expectSend:     true,
			expectedRecips: []string{"valid@example.com"},
			description:    "Should filter out all placeholder variations and send to valid address",
		},
		{
			name:           "only placeholders without angle brackets",
			recipients:     []string{"example@email.com"},
			expectSend:     false,
			expectedRecips: nil,
			description:    "Should skip sending when placeholder is without angle brackets",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockNS := &mockNotificationService{}
			sender := emailSender{ns: mockNS}

			cmd := &receivers.SendEmailSettings{
				To:          tt.recipients,
				Subject:     "Test Subject",
				SingleEmail: true,
			}

			err := sender.SendEmail(context.Background(), cmd)
			require.NoError(t, err, tt.description)

			if tt.expectSend {
				assert.True(t, mockNS.sendEmailCalled, "Expected email to be sent but it was not")
				assert.Equal(t, tt.expectedRecips, mockNS.lastCommand.SendEmailCommand.To, "Recipients mismatch")
			} else {
				assert.False(t, mockNS.sendEmailCalled, "Expected email not to be sent but it was")
			}
		})
	}
}

func TestEmailSender_SendEmail_EmptyRecipients(t *testing.T) {
	mockNS := &mockNotificationService{}
	sender := emailSender{ns: mockNS}

	cmd := &receivers.SendEmailSettings{
		To:          []string{},
		Subject:     "Test Subject",
		SingleEmail: true,
	}

	err := sender.SendEmail(context.Background(), cmd)
	require.NoError(t, err)
	assert.False(t, mockNS.sendEmailCalled, "Should not send email with empty recipient list")
}

func TestEmailSender_SendEmail_EmbeddedContents(t *testing.T) {
	mockNS := &mockNotificationService{}
	sender := emailSender{ns: mockNS}

	cmd := &receivers.SendEmailSettings{
		To:          []string{"user@example.com"},
		Subject:     "Test with embedded content",
		SingleEmail: true,
		EmbeddedContents: []receivers.EmbeddedContent{
			{Name: "image.png", Content: []byte("fake image data")},
		},
	}

	err := sender.SendEmail(context.Background(), cmd)
	require.NoError(t, err)
	assert.True(t, mockNS.sendEmailCalled, "Email should be sent")
	assert.Len(t, mockNS.lastCommand.SendEmailCommand.EmbeddedContents, 1, "Embedded content should be passed through")
	assert.Equal(t, "image.png", mockNS.lastCommand.SendEmailCommand.EmbeddedContents[0].Name)
}
