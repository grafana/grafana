#!/bin/bash

# Test runner with code owner identification
# Usage: ./test-with-owners.sh [go test arguments]
# Example: ./test-with-owners.sh -v ./...
# Example: ./test-with-owners.sh -run TestSpecific ./pkg/auth

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_colored() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print header
print_header() {
    echo
    print_colored $BLUE "================================================================="
    print_colored $BLUE "$1"
    print_colored $BLUE "================================================================="
    echo
}

# Check if CODEOWNERS file exists
if [ ! -f ".github/CODEOWNERS" ]; then
    print_colored $YELLOW "⚠️  Warning: .github/CODEOWNERS file not found"
    print_colored $YELLOW "   Code owner identification will be skipped"
    echo
fi

# Default to running all tests if no arguments provided
if [ $# -eq 0 ]; then
    TEST_ARGS="./..."
else
    TEST_ARGS="$@"
fi

print_header "Running Go Tests"
print_colored $BLUE "Command: go test -v $TEST_ARGS"
echo

# Create temporary file for test output
TEST_OUTPUT=$(mktemp)

# Run go test and capture output
go test -v $TEST_ARGS 2>&1 | tee "$TEST_OUTPUT"
TEST_EXIT_CODE=${PIPESTATUS[0]}

echo

# Check if tests failed
if [ $TEST_EXIT_CODE -ne 0 ]; then
    print_header "❌ Tests Failed - Identifying Code Owners"
    
    # Check if we have CODEOWNERS file
    if [ ! -f ".github/CODEOWNERS" ]; then
        print_colored $YELLOW "Cannot identify code owners without .github/CODEOWNERS file"
        rm "$TEST_OUTPUT"
        exit $TEST_EXIT_CODE
    fi
    
    # Parse test failures and identify owners
    failures_found=false
    owners_found_file=$(mktemp)
    
    # Look for failed tests with file paths
    while IFS= read -r line; do
        # Look for file paths in test output (absolute or relative paths)
        if [[ "$line" =~ ([^[:space:]]+\.go):([0-9]+) ]]; then
            full_path="${BASH_REMATCH[1]}"
            line_number="${BASH_REMATCH[2]}"
            
            # Convert absolute path to relative path if needed
            if [[ "$full_path" == /* ]]; then
                # Remove the current working directory from the absolute path
                file_path="${full_path#$PWD/}"
                # If the path doesn't start with the current directory, try to extract just the relevant part
                if [[ "$file_path" == "$full_path" ]]; then
                    # Try to extract everything after the last occurrence of the repository structure
                    if [[ "$full_path" =~ .*/grafana/(.+)$ ]]; then
                        file_path="${BASH_REMATCH[1]}"
                    else
                        file_path="$full_path"
                    fi
                fi
            else
                file_path="$full_path"
            fi
            
            # Get the test context (look for the test name in surrounding lines)
            test_name=$(grep -B 10 -A 5 "$line" "$TEST_OUTPUT" | grep -E "=== RUN|--- FAIL:" | tail -1 | sed -E 's/.*(Test[A-Za-z0-9_]*).*/\1/')
            
            # Use our CLI tool to find the code owner
            owner_output=$(./scripts/codeowners-tools/get-owner.sh . "$file_path" 2>/dev/null)
            
            if [[ "$owner_output" =~ Code\ owner\ for\ .*:\ (.+) ]]; then
                owner="${BASH_REMATCH[1]}"
                
                # Track unique failures (using a temp file instead of associative array)
                failure_key="$file_path:$line_number"
                if ! grep -q "^$failure_key|" "$owners_found_file" 2>/dev/null; then
                    echo "$failure_key|$owner|$test_name" >> "$owners_found_file"
                    failures_found=true
                fi
            fi
        fi
    done < "$TEST_OUTPUT"
    
    # Also look for panic/error messages
    grep -E "panic:|runtime error:|fatal error:" "$TEST_OUTPUT" | while IFS= read -r line; do
        if [[ "$line" =~ ([^[:space:]]+\.go):([0-9]+) ]]; then
            full_path="${BASH_REMATCH[1]}"
            line_number="${BASH_REMATCH[2]}"
            
            # Convert absolute path to relative path if needed
            if [[ "$full_path" == /* ]]; then
                file_path="${full_path#$PWD/}"
                if [[ "$file_path" == "$full_path" ]]; then
                    if [[ "$full_path" =~ .*/grafana/(.+)$ ]]; then
                        file_path="${BASH_REMATCH[1]}"
                    else
                        file_path="$full_path"
                    fi
                fi
            else
                file_path="$full_path"
            fi
            
            owner_output=$(./scripts/codeowners-tools/get-owner.sh . "$file_path" 2>/dev/null)
            
            if [[ "$owner_output" =~ Code\ owner\ for\ .*:\ (.+) ]]; then
                owner="${BASH_REMATCH[1]}"
                failure_key="$file_path:$line_number"
                if ! grep -q "^$failure_key|" "$owners_found_file" 2>/dev/null; then
                    echo "$failure_key|$owner|PANIC/ERROR" >> "$owners_found_file"
                    failures_found=true
                fi
            fi
        fi
    done
    
    # Display results
    if [ "$failures_found" = true ]; then
        print_colored $RED "📋 Code Owners for Failed Tests:"
        echo
        
        # Sort and display unique failures
        while IFS='|' read -r failure_key owner test_name; do
            IFS=':' read -r file_path line_number <<< "$failure_key"
            
            print_colored $YELLOW "  • $file_path:$line_number"
            if [ "$test_name" != "PANIC/ERROR" ]; then
                print_colored $BLUE "    Test: $test_name"
            else
                print_colored $RED "    Issue: Panic/Runtime Error"
            fi
            print_colored $GREEN "    Owner: $owner"
            echo
        done < "$owners_found_file"
        
        print_colored $BLUE "💡 Next Steps:"
        echo "   1. Review if your code changes could have affected these files"
        echo "   2. If not create a new issue and assign the code owner to inform of a potentially flakey test"
        
    else
        print_colored $YELLOW "No code owners found for failed tests"
        print_colored $YELLOW "This might indicate:"
        echo "   • Test failures in files not covered by CODEOWNERS"
        echo "   • Issues with parsing test output"
        echo "   • Missing or incomplete CODEOWNERS file"
    fi
    
    # Clean up temp file
    rm -f "$owners_found_file"
    
else
    print_header "✅ All Tests Passed"
    print_colored $GREEN "Great job! No failing tests to analyze."
fi

# Clean up
rm "$TEST_OUTPUT"

echo
print_colored $BLUE "================================================================="
exit $TEST_EXIT_CODE 