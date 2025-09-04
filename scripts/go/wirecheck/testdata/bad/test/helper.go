package test

import (
	"testing"

	"github.com/grafana/grafana/scripts/go/wirecheck/testdata/bad"
)

// TestDatabase represents a test database
type TestDatabase struct {
	name string
}

// NewTestDatabase creates a test database
func NewTestDatabase(name string) *TestDatabase {
	return &TestDatabase{name: name}
}

// Reset resets the test database
func (tdb *TestDatabase) Reset() {
	// Reset logic here
}

// TestLogger represents a test logger
type TestLogger struct {
	messages []string
}

// NewTestLogger creates a test logger
func NewTestLogger() *TestLogger {
	return &TestLogger{messages: make([]string, 0)}
}

// GetMessages returns logged messages
func (tl *TestLogger) GetMessages() []string {
	return tl.messages
}

// Clear clears logged messages
func (tl *TestLogger) Clear() {
	tl.messages = tl.messages[:0]
}

// CreateTestServer creates a server for testing
// This function calls methods on dependencies - should be detected by wire-checker
func CreateTestServer() *bad.Server {
	db := bad.ProvideDatabase()
	logger := bad.ProvideLogger()

	// This is a dependency call that should be detected
	db.Connect()

	// This is another dependency call that should be detected
	logger.Log("Setting up test server")

	userService := bad.ProvideUserService(db, logger)
	return bad.ProvideServer(userService, logger)
}

// ProvideTestDatabase creates a test database
// This function calls methods on dependencies - should be detected by wire-checker
func ProvideTestDatabase(testDb *TestDatabase) *bad.Database {
	// This is a dependency call that should be detected
	testDb.Reset()

	return bad.NewDatabase("test://localhost:5432/testdb")
}

// ProvideTestLogger creates a test logger
// This function calls methods on dependencies - should be detected by wire-checker
func ProvideTestLogger(testLogger *TestLogger) *bad.Logger {
	// This is a dependency call that should be detected
	testLogger.Clear()

	return bad.NewLogger("DEBUG")
}

// ValidateServer validates a server instance
func ValidateServer(t *testing.T, server *bad.Server) {
	if server == nil {
		t.Error("Server should not be nil")
	}
}
