package schemaversion

// V17 migrates panel minSpan to maxPerRow property.
// For panels with minSpan property, it calculates maxPerRow based on grid column count factors
// and removes the minSpan property.
//
// Example before migration:
//
//	{
//	  "panels": [
//	    {
//	      "id": 1,
//	      "minSpan": 6,
//	      "type": "graph"
//	    }
//	  ]
//	}
//
// Example after migration:
//
//	{
//	  "panels": [
//	    {
//	      "id": 1,
//	      "maxPerRow": 4,
//	      "type": "graph"
//	    }
//	  ]
//	}
func V17(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 17

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	const gridColumnCount = 24

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		minSpan, hasMinSpan := panel["minSpan"]
		if !hasMinSpan {
			continue
		}

		// Extract minSpan value
		var minSpanValue float64
		switch v := minSpan.(type) {
		case int:
			minSpanValue = float64(v)
		case float64:
			minSpanValue = v
		default:
			continue
		}

		if minSpanValue > 0 {
			max := gridColumnCount / minSpanValue
			factors := getFactors(gridColumnCount)

			// Find the best match compared to factors
			maxPerRow := 1 // default value
			for i, factor := range factors {
				if float64(factor) > max {
					if i > 0 {
						maxPerRow = factors[i-1]
					}
					break
				}
				maxPerRow = factor
			}

			panel["maxPerRow"] = maxPerRow
		}

		// Remove the minSpan property
		delete(panel, "minSpan")
	}

	return nil
}

// getFactors returns the factors of a number
// Example getFactors(24) -> [1, 2, 3, 4, 6, 8, 12, 24]
func getFactors(num int) []int {
	var factors []int
	for i := 1; i <= num; i++ {
		if num%i == 0 {
			factors = append(factors, i)
		}
	}
	return factors
}
