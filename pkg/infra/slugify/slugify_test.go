package slugify

import (
	"testing"
)

func TestSlugify(t *testing.T) {
	results := make(map[string]string)
	results["hello-playground"] = "Hello, playground"
	results["hello-it-s-paradise"] = "😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬 Hello, it's paradise"
	results["61db60b5-f1e7-5853-9b81-0f074fc268ea"] = "😢 😣 😤 😥 😦 😧 😨 😩 😪 😫 😬"
	results["8J-YoiAt"] = "😢 -"
	results["a"] = "?,a . \n "
	results["0a68eb57-c88a-5f34-9e9d-27f85e68af4f"] = "" // empty input has a slug!
	results["hi-this-is-a-test"] = "方向盤後面 hi this is a test خلف المقو"
	results["cong-hoa-xa-hoi-chu-nghia-viet-nam"] = "Cộng hòa xã hội chủ nghĩa Việt Nam"
	results["noi-nang-canh-canh-ben-long-bieng-khuay"] = "Nỗi nàng canh cánh bên lòng biếng khuây" // This line in a poem called Truyen Kieu

	for slug, original := range results {
		actual := Slugify(original)

		if actual != slug {
			t.Errorf("Expected '%s', got: %s", slug, actual)
		}
	}
}

func BenchmarkSlugify(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Slugify("Hello, world!")
	}
}

func BenchmarkSlugifyLongString(b *testing.B) {
	for i := 0; i < b.N; i++ {
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
