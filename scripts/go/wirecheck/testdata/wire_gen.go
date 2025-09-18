package main

import (
	"fmt"

	"github.com/grafana/grafana/tools/wire-checker/testdata/bad"
	badtest "github.com/grafana/grafana/tools/wire-checker/testdata/bad/test"
	"github.com/grafana/grafana/tools/wire-checker/testdata/good"
)

// ComplexServer represents a complex server type for testing
type ComplexServer struct {
	Name string
}

// Initialize simulates a wire_gen.go Initialize function for testing
// This function calls functions from imported packages to trigger wire-checker analysis
func Initialize() (*ComplexServer, error) {
	fmt.Println("Testing wire-checker on imported packages...")

	// Call individual provide functions from imported packages - this should trigger analysis
	// of the imported packages' provide functions for dependency calls
	db := bad.ProvideDatabase()
	logger := bad.ProvideLogger()
	userService := bad.ProvideUserService(db, logger)
	server := bad.ProvideServer(userService, logger)

	// Also call provide functions from the package without deps
	config := good.ProvideConfig()
	repository := good.ProvideRepository(config)
	service := good.ProvideService(config, repository)
	application := good.ProvideApplication(config, service)

	// Call provider functions from bad/test package
	testDb := badtest.NewTestDatabase("test-db")
	testLogger := badtest.NewTestLogger()
	testDatabase := badtest.ProvideTestDatabase(testDb)
	testLoggerProvider := badtest.ProvideTestLogger(testLogger)
	testServer := badtest.CreateTestServer()

	fmt.Printf("Created server: %T, application: %T, testServer: %T\n", server, application, testServer)
	fmt.Printf("Test components: %T, %T\n", testDatabase, testLoggerProvider)

	return &ComplexServer{Name: "test-server"}, nil
}
