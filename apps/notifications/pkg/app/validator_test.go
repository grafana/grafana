package app

import (
	"strings"
	"testing"

	notificationsv0alpha1 "github.com/grafana/grafana/apps/notifications/pkg/apis/notifications/v0alpha1"
)

func makeNotification(recipientUID string, orgID int64, excerpt string) *notificationsv0alpha1.Notification {
	n := notificationsv0alpha1.NewNotification()
	n.Spec.RecipientUID = recipientUID
	n.Spec.OrgID = orgID
	n.Spec.Excerpt = excerpt
	return n
}

func TestValidator_ExcerptTooLong(t *testing.T) {
	obj := makeNotification("user-1", 1, strings.Repeat("a", 281))
	if err := validateNotification(obj); err == nil {
		t.Fatal("expected error for excerpt > 280 chars, got nil")
	}
}

func TestValidator_ExcerptUnicodeLimit(t *testing.T) {
	// 280 multi-byte Unicode characters should be accepted.
	obj := makeNotification("user-1", 1, strings.Repeat("é", 280))
	if err := validateNotification(obj); err != nil {
		t.Fatalf("unexpected error for 280-rune excerpt: %v", err)
	}
	// 281 multi-byte runes must fail.
	obj2 := makeNotification("user-1", 1, strings.Repeat("é", 281))
	if err := validateNotification(obj2); err == nil {
		t.Fatal("expected error for 281-rune excerpt, got nil")
	}
}

func TestValidator_RecipientUIDEmpty(t *testing.T) {
	obj := makeNotification("", 1, "hello")
	if err := validateNotification(obj); err == nil {
		t.Fatal("expected error for empty recipientUID, got nil")
	}
}

func TestValidator_OrgIDZero(t *testing.T) {
	obj := makeNotification("user-1", 0, "hello")
	if err := validateNotification(obj); err == nil {
		t.Fatal("expected error for orgID=0, got nil")
	}
}

func TestValidator_OrgIDNegative(t *testing.T) {
	obj := makeNotification("user-1", -1, "hello")
	if err := validateNotification(obj); err == nil {
		t.Fatal("expected error for orgID<0, got nil")
	}
}

func TestValidator_Valid(t *testing.T) {
	obj := makeNotification("user-1", 1, "This is a valid notification.")
	if err := validateNotification(obj); err != nil {
		t.Fatalf("unexpected error for valid notification: %v", err)
	}
}
