package models

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateSourceURL(t *testing.T) {
	require.NoError(t, ValidateSourceURL(""))
	require.NoError(t, ValidateSourceURL("https://example.com/alerts/rule.yaml"))
	require.NoError(t, ValidateSourceURL("http://example.com"))

	require.Error(t, ValidateSourceURL("javascript:alert(1)"))
	require.Error(t, ValidateSourceURL("https://user:pass@example.com/rule")) // trufflehog:ignore
	require.Error(t, ValidateSourceURL("https:///missing-host"))
	require.Error(t, ValidateSourceURL("ftp://example.com/rule"))
	require.Error(t, ValidateSourceURL(strings.Repeat("a", MaxSourceURLLength+1)))
}

func TestNewSourceURLPointer(t *testing.T) {
	ptr, err := NewSourceURLPointer("https://example.com/alerts/rule.yaml", ProvenanceAPI)
	require.NoError(t, err)
	require.NotNil(t, ptr)
	require.Equal(t, "https://example.com/alerts/rule.yaml", *ptr)

	ptr, err = NewSourceURLPointer("", ProvenanceNone)
	require.NoError(t, err)
	require.NotNil(t, ptr)
	require.Empty(t, *ptr)

	_, err = NewSourceURLPointer("https://example.com/alerts/rule.yaml", ProvenanceNone)
	require.ErrorIs(t, err, ErrAlertRuleFailedValidation)

	_, err = NewSourceURLPointer("javascript:alert(1)", ProvenanceAPI)
	require.ErrorIs(t, err, ErrAlertRuleFailedValidation)
}

func TestSourceURLFromAnnotation(t *testing.T) {
	ptr, err := SourceURLFromAnnotation("", ProvenanceAPI)
	require.NoError(t, err)
	require.Nil(t, ptr)

	ptr, err = SourceURLFromAnnotation("alerts/rule.json", ProvenanceAPI)
	require.NoError(t, err)
	require.Nil(t, ptr)

	ptr, err = SourceURLFromAnnotation("ftp://example.com/rule", ProvenanceAPI)
	require.NoError(t, err)
	require.Nil(t, ptr)

	ptr, err = SourceURLFromAnnotation("https://example.com/alerts/rule.yaml", ProvenanceAPI)
	require.NoError(t, err)
	require.NotNil(t, ptr)
	require.Equal(t, "https://example.com/alerts/rule.yaml", *ptr)

	_, err = SourceURLFromAnnotation("https://example.com/alerts/rule.yaml", ProvenanceNone)
	require.ErrorIs(t, err, ErrAlertRuleFailedValidation)

	_, err = SourceURLFromAnnotation("https://user:pass@example.com/rule", ProvenanceAPI) // trufflehog:ignore
	require.ErrorIs(t, err, ErrAlertRuleFailedValidation)

	_, err = SourceURLFromAnnotation("https:///missing-host", ProvenanceAPI)
	require.ErrorIs(t, err, ErrAlertRuleFailedValidation)
}

func TestAlertRuleSourceURLDiffAndCopy(t *testing.T) {
	sourceURL := "https://example.com/alerts/rule.yaml"
	original := &AlertRule{UID: "rule", SourceURL: &sourceURL}

	copied := original.Copy()
	require.NotNil(t, copied.SourceURL)
	require.Equal(t, sourceURL, *copied.SourceURL)
	*copied.SourceURL = "https://example.com/other"
	require.Equal(t, sourceURL, *original.SourceURL)

	withoutURL := original.Copy()
	withoutURL.SourceURL = nil
	require.Empty(t, original.Diff(withoutURL))
}
