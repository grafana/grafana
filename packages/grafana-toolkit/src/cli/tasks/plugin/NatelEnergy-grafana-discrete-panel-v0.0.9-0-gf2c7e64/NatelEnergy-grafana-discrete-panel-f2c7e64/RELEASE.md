filling in the history:

```
git tag -a v0.0.8 5e8e975c881e443d72ac17830aca986c86ca95a2 -m "Release v0.0.8";
git tag -a v0.0.7 e9b0f671547beadc5870856d4f2a4b5082df0d4b -m "Release v0.0.7";
git tag -a v0.0.6 38fbda226a2431e6ef44e2b1a6c5759f3fbf4268 -m "Release v0.0.6";
git tag -a v0.0.5 10d9ec42ecee32d9b4a35385be5c89410176ea8d -m "Release v0.0.5";
git tag -a v0.0.4 39a4eb44ab7f8d082478050058ead371a12aa5e2 -m "Release v0.0.4";
git tag -a v0.0.3 91be5c8cc445cbb1c6d113f27712c9ada6081de2 -m "Release v0.0.3";
git tag -a v0.0.2 6d963171005734b0392525854576bd21c5ca1661 -m "Release v0.0.2";
git tag -a v0.0.1 d729bd3b0cc71e4de1aab934065c72931fd4487e -m "Release v0.0.1";
git push --tags
```

Remove all old releases:

```
#Delete local tags.
git tag -d $(git tag -l)
#Fetch remote tags.
git fetch
#Delete remote tags.
git push origin --delete $(git tag -l) # Pushing once should be faster than multiple times
#Delete local tags.
git tag -d $(git tag -l)
```
