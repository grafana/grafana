import React from 'react';
import { CollapsableSection, FileUpload, Icon } from '@grafana/ui';
import { useThumbnail } from 'app/features/search/hooks/useThumbnail';

interface Props {
  uid: string;
}

export const PreviewSettings = (props: Props) => {
  const lightThumb = useThumbnail(props.uid, true);
  const darkThumb = useThumbnail(props.uid, false);

  const doUpload = (evt: EventTarget & HTMLInputElement, isLight?: boolean) => {
    const file = evt?.files && evt.files[0];
    if (!file) {
      console.log('NOPE!', evt);
      return;
    }

    isLight ? lightThumb.update(file) : darkThumb.update(file);
  };

  const imgstyle = { maxWidth: 300, maxHeight: 300 };

  return (
    <CollapsableSection label="Preview settings" isOpen={true}>
      <div>DUMMY UI just so we have an upload button!</div>
      <table cellSpacing="4">
        <thead>
          <tr>
            <td>[DARK]</td>
            <td>[LIGHT]</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {darkThumb.imageSrc ? (
                <img src={darkThumb.imageSrc} style={imgstyle} />
              ) : (
                <div style={imgstyle}>
                  <Icon name="apps" size="xl" />
                </div>
              )}{' '}
            </td>
            <td>
              {lightThumb.imageSrc ? (
                <img src={lightThumb.imageSrc} style={imgstyle} />
              ) : (
                <div style={imgstyle}>
                  <Icon name="apps" size="xl" />
                </div>
              )}{' '}
            </td>
          </tr>
          <tr>
            <td>
              <FileUpload
                accept="image/png, image/webp"
                onFileUpload={({ currentTarget }) => doUpload(currentTarget, false)}
              >
                Upload dark
              </FileUpload>
            </td>
            <td>
              <FileUpload
                accept="image/png, image/webp"
                onFileUpload={({ currentTarget }) => doUpload(currentTarget, true)}
              >
                Upload light
              </FileUpload>
            </td>
          </tr>
        </tbody>
      </table>
    </CollapsableSection>
  );
};
