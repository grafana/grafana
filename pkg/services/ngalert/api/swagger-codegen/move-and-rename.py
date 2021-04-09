import os
path = '../go'
files = os.listdir(path)
dest_dir = "../"

for index, file in enumerate(files):
	os.rename(os.path.join(path, file), os.path.join(dest_dir, ''.join(['generated_base_',file.split('.')[0], '.go'])))
