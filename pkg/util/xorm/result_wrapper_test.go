package xorm

import (
	"errors"
	"testing"
)

// mockResult implements sql.Result for testing
type mockResult struct {
	rowsAffected    int64
	lastInsertId    int64
	rowsAffectedErr error
	lastInsertIdErr error
}

func (m *mockResult) RowsAffected() (int64, error) {
	return m.rowsAffected, m.rowsAffectedErr
}

func (m *mockResult) LastInsertId() (int64, error) {
	return m.lastInsertId, m.lastInsertIdErr
}

func TestYDBResultWrapper_RowsAffected(t *testing.T) {
	tests := []struct {
		name         string
		mockResult   *mockResult
		expectedRows int64
		expectedErr  error
	}{
		{
			name: "normal case - no error",
			mockResult: &mockResult{
				rowsAffected:    5,
				rowsAffectedErr: nil,
			},
			expectedRows: 5,
			expectedErr:  nil,
		},
		{
			name: "not implemented error - should return 0",
			mockResult: &mockResult{
				rowsAffected:    0,
				rowsAffectedErr: errors.New("RowsAffected not implemented"),
			},
			expectedRows: 0,
			expectedErr:  nil,
		},
		{
			name: "not supported error - should return 0",
			mockResult: &mockResult{
				rowsAffected:    0,
				rowsAffectedErr: errors.New("RowsAffected is not supported"),
			},
			expectedRows: 0,
			expectedErr:  nil,
		},
		{
			name: "unimplemented error - should return 0",
			mockResult: &mockResult{
				rowsAffected:    0,
				rowsAffectedErr: errors.New("unimplemented feature"),
			},
			expectedRows: 0,
			expectedErr:  nil,
		},
		{
			name: "other error - should return error",
			mockResult: &mockResult{
				rowsAffected:    0,
				rowsAffectedErr: errors.New("database connection failed"),
			},
			expectedRows: 0,
			expectedErr:  errors.New("database connection failed"),
		},
		{
			name:         "nil result - should return 0",
			mockResult:   nil,
			expectedRows: 0,
			expectedErr:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var wrapper *YDBResultWrapper
			if tt.mockResult != nil {
				wrapper = NewYDBResultWrapper(tt.mockResult)
			} else {
				wrapper = NewYDBResultWrapper(nil)
			}

			rows, err := wrapper.RowsAffected()

			if rows != tt.expectedRows {
				t.Errorf("expected rows affected %d, got %d", tt.expectedRows, rows)
			}

			if tt.expectedErr == nil && err != nil {
				t.Errorf("expected no error, got %v", err)
			} else if tt.expectedErr != nil && err == nil {
				t.Errorf("expected error %v, got nil", tt.expectedErr)
			} else if tt.expectedErr != nil && err != nil && err.Error() != tt.expectedErr.Error() {
				t.Errorf("expected error %v, got %v", tt.expectedErr, err)
			}
		})
	}
}

func TestYDBResultWrapper_LastInsertId(t *testing.T) {
	tests := []struct {
		name        string
		mockResult  *mockResult
		expectedId  int64
		expectedErr error
	}{
		{
			name: "normal case - no error",
			mockResult: &mockResult{
				lastInsertId:    123,
				lastInsertIdErr: nil,
			},
			expectedId:  123,
			expectedErr: nil,
		},
		{
			name: "error case",
			mockResult: &mockResult{
				lastInsertId:    0,
				lastInsertIdErr: errors.New("LastInsertId not supported"),
			},
			expectedId:  0,
			expectedErr: errors.New("LastInsertId not supported"),
		},
		{
			name:        "nil result - should return error",
			mockResult:  nil,
			expectedId:  0,
			expectedErr: errors.New("LastInsertId is not supported"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var wrapper *YDBResultWrapper
			if tt.mockResult != nil {
				wrapper = NewYDBResultWrapper(tt.mockResult)
			} else {
				wrapper = NewYDBResultWrapper(nil)
			}

			id, err := wrapper.LastInsertId()

			if id != tt.expectedId {
				t.Errorf("expected last insert id %d, got %d", tt.expectedId, id)
			}

			if tt.expectedErr == nil && err != nil {
				t.Errorf("expected no error, got %v", err)
			} else if tt.expectedErr != nil && err == nil {
				t.Errorf("expected error %v, got nil", tt.expectedErr)
			} else if tt.expectedErr != nil && err != nil && err.Error() != tt.expectedErr.Error() {
				t.Errorf("expected error %v, got %v", tt.expectedErr, err)
			}
		})
	}
}

func TestIsNotImplementedError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error",
			err:      nil,
			expected: false,
		},
		{
			name:     "not implemented error",
			err:      errors.New("not implemented"),
			expected: true,
		},
		{
			name:     "not supported error",
			err:      errors.New("not supported"),
			expected: true,
		},
		{
			name:     "unimplemented error",
			err:      errors.New("unimplemented"),
			expected: true,
		},
		{
			name:     "unsupported error",
			err:      errors.New("unsupported"),
			expected: true,
		},
		{
			name:     "RowsAffected not implemented",
			err:      errors.New("RowsAffected not implemented"),
			expected: true,
		},
		{
			name:     "RowsAffected is not supported",
			err:      errors.New("RowsAffected is not supported"),
			expected: true,
		},
		{
			name:     "case insensitive - NOT IMPLEMENTED",
			err:      errors.New("NOT IMPLEMENTED"),
			expected: true,
		},
		{
			name:     "other error",
			err:      errors.New("database connection failed"),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isNotImplementedError(tt.err)
			if result != tt.expected {
				t.Errorf("expected %v, got %v for error: %v", tt.expected, result, tt.err)
			}
		})
	}
}
