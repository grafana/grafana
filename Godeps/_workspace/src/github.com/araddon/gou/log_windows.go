// +build windows

package gou

// Determine is this process is running in a Terminal or not?
func IsTerminal() bool {
	return false // TODO Needs correct implementation on Windows
}
