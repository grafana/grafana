package screenshot

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestScreenshotOptions(t *testing.T) {
	o := ScreenshotOptions{}
	assert.Equal(t, ScreenshotOptions{}, o)

	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Width = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Height = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Theme = "Not a theme"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, ScreenshotOptions{
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout + 1,
	}, o)
}

func TestScreenshotOptions_Hash(t *testing.T) {
	o := ScreenshotOptions{}
	assert.Equal(t, []byte{0xd7, 0xf3, 0x56, 0x7f, 0xec, 0x7b, 0xdf, 0x95}, o.Hash())

	o = o.SetDefaults()
	assert.Equal(t, []byte{0x71, 0x54, 0xe8, 0xea, 0x2, 0xf4, 0xd6, 0xd3}, o.Hash())

	o.OrgID = 1
	assert.Equal(t, []byte{0x8, 0x75, 0x48, 0x46, 0x88, 0xa9, 0xf3, 0xe6}, o.Hash())

	o.Width = 100
	assert.Equal(t, []byte{0xff, 0xf3, 0xb1, 0x1, 0x1e, 0x20, 0x46, 0xd4}, o.Hash())

	o.Height = 100
	assert.Equal(t, []byte{0x57, 0xdb, 0xa7, 0xb8, 0x5a, 0x7f, 0x26, 0xe0}, o.Hash())

	o.Theme = "Not a theme"
	assert.Equal(t, []byte{0xc2, 0x7e, 0xed, 0x19, 0x95, 0x32, 0x55, 0x85}, o.Hash())

	// the timeout should not change the sum
	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, []byte{0xc2, 0x7e, 0xed, 0x19, 0x95, 0x32, 0x55, 0x85}, o.Hash())
}
