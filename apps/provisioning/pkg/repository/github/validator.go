package github

import (
	"context"
	"net"
	"net/url"
	"regexp"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
)

// isValidGitHubURL validates GitHub URL format including GitHub Enterprise and self-hosted instances
func isValidGitHubURL(gitURL string) bool {
	if gitURL == "" {
		return false
	}

	// Parse URL to validate structure
	parsed, err := url.Parse(gitURL)
	if err != nil {
		return false
	}

	// Must be HTTPS
	if parsed.Scheme != "https" {
		return false
	}

	// Must have a valid host (domain name or IP address)
	if parsed.Host == "" {
		return false
	}

	// Validate host format (domain or IP)
	if !isValidHost(parsed.Host) {
		return false
	}

	// Clean up path: remove .git suffix and trailing slashes
	cleanPath := strings.TrimSuffix(strings.TrimRight(parsed.Path, "/"), ".git")
	cleanPath = strings.TrimRight(cleanPath, "/")

	// Must have a path with at least owner/repo
	if cleanPath == "" || cleanPath == "/" {
		return false
	}

	// Path should have at least 2 segments (owner and repo)
	pathParts := strings.Split(strings.Trim(cleanPath, "/"), "/")
	if len(pathParts) < 2 {
		return false
	}

	// Validate that owner and repo names are not empty and contain valid characters
	for i := 0; i < 2; i++ {
		if !isValidPathSegment(pathParts[i]) {
			return false
		}
	}

	return true
}

// isValidHost validates domain names and IP addresses
func isValidHost(host string) bool {
	// Remove port if present
	hostOnly, _, err := net.SplitHostPort(host)
	if err != nil {
		// If no port, hostOnly is the entire host
		hostOnly = host
	}

	// Handle IPv6 addresses in brackets (e.g., [2001:db8::1])
	if strings.HasPrefix(hostOnly, "[") && strings.HasSuffix(hostOnly, "]") {
		hostOnly = hostOnly[1 : len(hostOnly)-1]
	}

	// Check if it's an IP address
	if net.ParseIP(hostOnly) != nil {
		return true
	}

	// Check if it's a valid domain name
	if !isValidDomainName(hostOnly) {
		return false
	}

	return true
}

// isValidDomainName validates domain name format
func isValidDomainName(domain string) bool {
	if len(domain) == 0 || len(domain) > 253 {
		return false
	}

	// Domain name regex: alphanumeric, hyphens, dots
	// Cannot start or end with hyphen or dot
	// Cannot have consecutive dots
	domainPattern := regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$`)
	return domainPattern.MatchString(domain)
}

// isValidPathSegment validates GitHub path segments (owner/repo names)
func isValidPathSegment(segment string) bool {
	if len(segment) == 0 || len(segment) > 100 {
		return false
	}

	// GitHub allows alphanumeric characters, hyphens, underscores, and dots
	// Cannot start with a dot or hyphen
	segmentPattern := regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9._-]*$`)
	return segmentPattern.MatchString(segment)
}

// Validate validates the github repository configuration without requiring decrypted secrets.
func Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	if repo.Spec.Type != provisioning.GitHubRepositoryType {
		return nil
	}

	gh := repo.Spec.GitHub
	if gh == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "github"), "a github config is required"),
		}
	}

	var list field.ErrorList

	if gh.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "url"), "a github url is required"))
	} else {
		if !isValidGitHubURL(gh.URL) {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, "invalid GitHub URL format"))
		} else {
			// Additional validation for owner/repo parsing
			_, _, err := ParseOwnerRepoGithub(gh.URL)
			if err != nil {
				list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, err.Error()))
			}
		}
	}

	if len(list) > 0 {
		return list
	}

	// Validate git-related fields (branch, path, token/connection) using the shared git validator
	list = append(list, git.ValidateGitConfigFields(repo, gh.URL, gh.Branch, gh.Path)...)
	return list
}
