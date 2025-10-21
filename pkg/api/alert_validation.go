package api

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

type ValidationResult struct {
	Valid  bool              `json:"valid"`
	Errors []ValidationError `json:"errors"`
}

type AlertRuleValidationRequest struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
	Datasource string `json:"datasource"`
}

func (hs *HTTPServer) ValidateAlertRule(c *contextmodel.ReqContext) response.Response {
	var req AlertRuleValidationRequest
	if err := c.Req.Body.DecodeJSON(&req); err != nil {
		return response.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	result := validateAlertRule(req.Name, req.Expression, req.Datasource)
	return response.JSON(http.StatusOK, result)
}

func validateAlertRule(name, expression, datasource string) ValidationResult {
	var errors []ValidationError
	maxNameLength := 100
	maxExprLength := 1000
	forbiddenPatterns := []string{"DROP", "DELETE", "TRUNCATE"}

	// Validate name
	if name == "" {
		errors = append(errors, ValidationError{
			Field:   "name",
			Message: "Alert rule name is required",
			Code:    "REQUIRED",
		})
	} else if len(name) > maxNameLength {
		errors = append(errors, ValidationError{
			Field:   "name",
			Message: fmt.Sprintf("Name exceeds maximum length of %d characters", maxNameLength),
			Code:    "MAX_LENGTH",
		})
	}

	// Validate expression
	if expression == "" {
		errors = append(errors, ValidationError{
			Field:   "expression",
			Message: "Query expression is required",
			Code:    "REQUIRED",
		})
	} else {
		if len(expression) > maxExprLength {
			errors = append(errors, ValidationError{
				Field:   "expression",
				Message: fmt.Sprintf("Expression exceeds maximum length of %d characters", maxExprLength),
				Code:    "MAX_LENGTH",
			})
		}

		// Check for forbidden patterns
		upperExpr := strings.ToUpper(expression)
		for _, pattern := range forbiddenPatterns {
			if strings.Contains(upperExpr, pattern) {
				errors = append(errors, ValidationError{
					Field:   "expression",
					Message: fmt.Sprintf("Expression contains forbidden pattern: %s", pattern),
					Code:    "FORBIDDEN_PATTERN",
				})
			}
		}

		// Validate syntax
		if !isValidExpression(expression) {
			errors = append(errors, ValidationError{
				Field:   "expression",
				Message: "Invalid expression syntax",
				Code:    "INVALID_SYNTAX",
			})
		}
	}

	// Validate datasource
	if datasource == "" {
		errors = append(errors, ValidationError{
			Field:   "datasource",
			Message: "Datasource is required",
			Code:    "REQUIRED",
		})
	}

	return ValidationResult{
		Valid:  len(errors) == 0,
		Errors: errors,
	}
}

func isValidExpression(expr string) bool {
	// Basic syntax validation - check for balanced parentheses
	balance := 0
	for _, char := range expr {
		if char == '(' {
			balance++
		} else if char == ')' {
			balance--
			if balance < 0 {
				return false
			}
		}
	}
	
	// Check for valid metric name pattern
	metricPattern := regexp.MustCompile(`^[a-zA-Z_:][a-zA-Z0-9_:]*`)
	return balance == 0 && metricPattern.MatchString(strings.TrimSpace(expr))
}