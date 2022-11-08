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
	assert.Equal(t, []byte{0xd9, 0x83, 0x82, 0x18, 0x6c, 0x3d, 0x7d, 0x47}, o.Hash())

	o = o.SetDefaults()
	assert.Equal(t, []byte{0x6, 0x7, 0x97, 0x6, 0x53, 0xf, 0x8b, 0xf1}, o.Hash())

	o.Width = 100
	o = o.SetDefaults()
	assert.Equal(t, []byte{0x25, 0x50, 0xb4, 0x4b, 0x43, 0xcd, 0x3, 0x49}, o.Hash())

	o.Height = 100
	o = o.SetDefaults()
	assert.Equal(t, []byte{0x51, 0xe2, 0x6f, 0x2c, 0x62, 0x7b, 0x3b, 0xc5}, o.Hash())

	o.Theme = "Not a theme"
	o = o.SetDefaults()
	assert.Equal(t, []byte{0x51, 0xe2, 0x6f, 0x2c, 0x62, 0x7b, 0x3b, 0xc5}, o.Hash())

	// the timeout should not change the sum
	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, []byte{0x51, 0xe2, 0x6f, 0x2c, 0x62, 0x7b, 0x3b, 0xc5}, o.Hash())
}
