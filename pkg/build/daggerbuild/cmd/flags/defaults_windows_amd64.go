package flags

// DefaultDistros are distributions that can quickly be built in an ideal scenario for the operating system on the above build tag.
var DefaultDistros = []string{"linux/amd64"}

// DefaultPlatform is the docker platform that will natively / most efficiently run on the OS/arch filtered by the above tag.
var DefaultPlatform = "linux/amd64"
