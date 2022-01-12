import React, { PureComponent } from 'react';
import { CollapsableSection, FileUpload, Icon } from '@grafana/ui';
import { fetchThumbnail, getThumbnailURL } from 'app/features/search/components/SearchCard';
import { GrafanaThemeType } from '@grafana/data/src';

interface Props {
  uid: string;
}

interface State {
  thumbnailDataUrls: {
    [GrafanaThemeType.Light]: string;
    [GrafanaThemeType.Dark]: string;
  };
}

export class PreviewSettings extends PureComponent<Props, State> {
  state: State = {
    thumbnailDataUrls: {
      [GrafanaThemeType.Dark]: '',
      [GrafanaThemeType.Light]: '',
    },
  };

  componentDidMount() {
    this.refetchThumbnails();
  }

  async refetchThumbnails() {
    await Promise.all([this.refetchThumbnail(GrafanaThemeType.Light), this.refetchThumbnail(GrafanaThemeType.Dark)]);
  }

  async refetchThumbnail(theme: GrafanaThemeType) {
    const imageDataUrl = await fetchThumbnail(this.props.uid, theme === GrafanaThemeType.Light);

    if (imageDataUrl) {
      this.setState((prevState) => ({
        ...prevState,
        thumbnailDataUrls: {
          ...prevState.thumbnailDataUrls,
          [theme]: imageDataUrl,
        },
      }));
    }
  }

  doUpload = (evt: EventTarget & HTMLInputElement, isLight?: boolean) => {
    const file = evt?.files && evt.files[0];
    if (!file) {
      console.log('NOPE!', evt);
      return;
    }

    const url = getThumbnailURL(this.props.uid, isLight);
    const formData = new FormData();
    formData.append('file', file);

    fetch(url, {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((result) => {
        console.log('Success:', result);
        return this.refetchThumbnail(isLight ? GrafanaThemeType.Light : GrafanaThemeType.Dark);
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  };

  render() {
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
                {this.state.thumbnailDataUrls[GrafanaThemeType.Dark].length ? (
                  <img src={this.state.thumbnailDataUrls[GrafanaThemeType.Dark]} style={imgstyle} />
                ) : (
                  <div style={imgstyle}>
                    <Icon name="apps" size="xl" />
                  </div>
                )}{' '}
              </td>
              <td>
                {this.state.thumbnailDataUrls[GrafanaThemeType.Light].length ? (
                  <img src={this.state.thumbnailDataUrls[GrafanaThemeType.Light]} style={imgstyle} />
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
                  onFileUpload={({ currentTarget }) => this.doUpload(currentTarget, false)}
                >
                  Upload dark
                </FileUpload>
              </td>
              <td>
                <FileUpload
                  accept="image/png, image/webp"
                  onFileUpload={({ currentTarget }) => this.doUpload(currentTarget, true)}
                >
                  Upload light
                </FileUpload>
              </td>
            </tr>
          </tbody>
        </table>
      </CollapsableSection>
    );
  }
}
