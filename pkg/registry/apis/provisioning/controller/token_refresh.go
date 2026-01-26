package controller

import "time"

const tokenRefreshBufferSeconds = 10

func tokenRecentlyCreated(issuingTime time.Time) bool {
	return issuingTime.After(time.Now().Add(-tokenRefreshBufferSeconds * time.Second))
}

// shouldRefreshBeforeExpiration determines if a token should be refreshed based on its expiration time
// and the controller's resync interval.
//
// The function uses a buffer calculation of (2 * resyncInterval + 10 seconds) to ensure tokens are
// refreshed well before they expire, avoiding timing issues.
//
// Examples:
//   - resyncInterval = 5 minutes: refresh 10 minutes and 10 seconds before expiration
//   - resyncInterval = 60 seconds: refresh 130 seconds (2m10s) before expiration
func shouldRefreshBeforeExpiration(expiration time.Time, resyncInterval time.Duration) bool {
	buffer := (2 * resyncInterval) + (tokenRefreshBufferSeconds * time.Second)
	return expiration.Before(time.Now().Add(buffer))
}
