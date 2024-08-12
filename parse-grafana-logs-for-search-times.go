package main

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
)

type Timing struct {
	Function string
	Time     float64
}

func main() {
	// Open the log file
	file, err := os.Open("grafana.log")
	if err != nil {
		fmt.Println("Error opening file:", err)
		return
	}
	defer file.Close()

	// Create a map to store the parsed data
	timings := make(map[string][]float64)

	// Define the regex pattern to match valid lines
	re := regexp.MustCompile(`^(listIDsThenSearch|buildIndexAndSearch|searchThenCheck),\d+(\.\d+)?ms$`)

	// Parse the file line by line
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()

		// Use regex to filter out lines that do not match the expected pattern
		if !re.MatchString(line) {
			continue // Skip lines that don't match the regex
		}
		// Split the line into function name and time
		parts := strings.Split(line, ",")
		if len(parts) != 2 {
			continue // Skip lines that don't match the expected format
		}

		// Parse the time value
		timeValue, err := strconv.ParseFloat(parts[1][:len(parts[1])-2], 64)
		if err != nil {
			fmt.Println("Error parsing time value:", err)
			continue
		}

		// Store the timing data
		functionName := parts[0]
		timings[functionName] = append(timings[functionName], timeValue)
	}

	// Output the parsed data with additional statistics
	for function, times := range timings {
		fmt.Printf("Function: %s\n", function)
		// fmt.Printf("Timings: %v\n", times)
		fmt.Printf("Average Time: %fms\n", average(times))
		fmt.Printf("Standard Deviation: %fms\n", stdDev(times))
		fmt.Printf("Min Time: %fms\n", min(times))
		fmt.Printf("Max Time: %fms\n", max(times))
		fmt.Println()
	}

	if err := scanner.Err(); err != nil {
		fmt.Println("Error reading file:", err)
	}
}

// Function to calculate the average time
func average(times []float64) float64 {
	sum := 0.0
	for _, time := range times {
		sum += time
	}
	return sum / float64(len(times))
}

// Function to calculate the standard deviation
func stdDev(times []float64) float64 {
	mean := average(times)
	var sumSquares float64
	for _, time := range times {
		diff := time - mean
		sumSquares += diff * diff
	}
	return math.Sqrt(sumSquares / float64(len(times)))
}

// Function to calculate the minimum time
func min(times []float64) float64 {
	if len(times) == 0 {
		return 0
	}
	minTime := times[0]
	for _, time := range times {
		if time < minTime {
			minTime = time
		}
	}
	return minTime
}

// Function to calculate the maximum time
func max(times []float64) float64 {
	if len(times) == 0 {
		return 0
	}
	maxTime := times[0]
	for _, time := range times {
		if time > maxTime {
			maxTime = time
		}
	}
	return maxTime
}
