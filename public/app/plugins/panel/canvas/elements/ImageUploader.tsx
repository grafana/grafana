import React, { useState } from 'react';

const ImageUploader = () => {
  const [file, setFile] = useState<File>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>();

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();

    let reader = new FileReader();
    const target = event.target as HTMLInputElement;
    const file: File = (target.files as FileList)[0];

    reader.onloadend = () => {
      setFile(file);
      setImagePreviewUrl(String(reader.result));
    };

    reader.readAsDataURL(file);
  };

  let $imagePreview = null;
  if (imagePreviewUrl) {
    $imagePreview = <img src={imagePreviewUrl} />;
  } else {
    $imagePreview = <div className="previewText">Please select an Image for Preview</div>;
  }

  return (
    <div className="previewComponent">
      <form>
        <input className="fileInput" type="file" onChange={handleImageChange} />
      </form>
      <div className="imgPreview">{$imagePreview}</div>
    </div>
  );
};

export default ImageUploader;
