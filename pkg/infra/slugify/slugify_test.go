package slugify

import (
	"testing"
)

func TestSlugify(t *testing.T) {
	results := make(map[string]string)
	results["hello-playground"] = "Hello, playground"
	results["37e4fb9"] = "😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬 Hello, it's paradise"
	results["f6bcbac"] = "😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬"
	results["f09f98a2"] = "😢 -"
	results["a"] = "?,a . \n "
	results["da39a3e"] = "" // empty input has a slug!
	results["f96f70a"] = "方向盤後面 hi this is a test خلف المقو"
	results["cong-hoa-xa-hoi-chu-nghia-viet-nam"] = "Cộng hòa xã hội chủ nghĩa Việt Nam"
	results["noi-nang-canh-canh-ben-long-bieng-khuay"] = "Nỗi nàng canh cánh bên lòng biếng khuây" // This line in a poem called Truyen Kieu
	results["hello-playground"] = "Hello / playground"
	results["hello-playground"] = "Hello % playground"
	results["hello-and-playground"] = "Hello & //% playground"
	results["hello-2a-23-playground"] = "Hello *# playground"

	for slug, original := range results {
		actual := Slugify(original)

		if actual != slug {
			t.Errorf("Expected '%s', got: %s", slug, actual)
		}
	}
}

func BenchmarkSlugify(b *testing.B) {
	for range b.N {
		Slugify("Hello, world!")
	}
}

func BenchmarkSlugifyLongString(b *testing.B) {
	for range b.N {
		Slugify(`
			😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬 Hello, it's paradise
			😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬 Hello, it's paradise
			😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬 Hello, it's paradise
			😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬 Hello, it's paradise
			Lorem ipsum dolor sit amet, consectetur adipiscing elit.
			Aliquam sapien nisl, laoreet quis vestibulum ut, cursus
			in turpis. Sed magna mi, blandit id nisi vel, imperdiet
			mollis turpis. Fusce vel fringilla mauris. Donec cursus
			rhoncus bibendum. Aliquam erat volutpat. Maecenas
			faucibus turpis ex, quis lacinia ligula ultrices non.
			Sed gravida justo augue. Nulla bibendum dignissim tellus
			vitae lobortis. Suspendisse fermentum vel purus in pulvinar.
			Vivamus eu fermentum purus, sit amet tempor orci.
			Praesent congue convallis turpis, ac ullamcorper lorem
			semper id.
		`)
	}
}
