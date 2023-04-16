import React, { useState, useCallback } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, Input, useTheme2 } from '@grafana/ui';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

import { docsTip, overhaulStyles, PROM_CONFIG_LABEL_WIDTH, validateDurationInput } from './ConfigEditor';

export interface ConnectionProps extends HttpSettingsBaseProps {
  /** The default url for the data source */
  defaultUrl?: string;
}

export const Connection = (props: ConnectionProps) => {
  const { defaultUrl, dataSourceConfig, onChange } = props;

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  const [validPromUrl, updateValidPromUrl] = useState<string>('');

  const onSettingsChange = useCallback(
    // eslint-disable-next-line
    (change: Partial<DataSourceSettings<any, any>>) => {
      onChange({
        ...dataSourceConfig,
        ...change,
      });
    },
    [dataSourceConfig, onChange]
  );

  let urlTooltip;

  switch (dataSourceConfig.access) {
    case 'direct':
      urlTooltip = (
        <>
          Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
          {docsTip()}
        </>
      );
      break;
    case 'proxy':
      urlTooltip = <>This URL must be accessible from the Grafana server. {docsTip()}</>;
      break;
    default:
      urlTooltip = 'Specify a complete HTTP URL (for example http://your_server:8080)';
  }

  const validUrlRegex = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;

  // const defaultUrl = 'http://localhost:9090';

  const urlInput = (
    <>
      <Input
        className="width-20"
        placeholder={defaultUrl}
        value={dataSourceConfig.url}
        // eslint-disable-next-line
        aria-label={selectors.components.DataSource.DataSourceHttpSettings.urlInput}
        onChange={(event) => onSettingsChange({ url: event.currentTarget.value })}
        disabled={dataSourceConfig.readOnly}
        onBlur={(e) => updateValidPromUrl(e.currentTarget.value)}
      />
      {validateDurationInput(validPromUrl, validUrlRegex)}
    </>
  );

  return (
    <>
      <hr />
      <h3 className={styles.sectionHeaderPadding}>Connection</h3>
      <p className={`${styles.secondaryGrey} ${styles.subsectionText}`}>
        Provide information to connect to this data source.
      </p>
      <div className="gf-form-group">
        <div className="gf-form">
          <InlineField
            interactive={true}
            label="Prometheus Server URL"
            labelWidth={PROM_CONFIG_LABEL_WIDTH}
            tooltip={urlTooltip}
          >
            {urlInput}
          </InlineField>
        </div>
      </div>
      <div className={`${styles.sectionBottomPadding} ${styles.secondaryGrey}`}>
        For more information on configuring the Grafana Prometheus data source see the{' '}
        <a
          style={{ textDecoration: 'underline' }}
          href="https://grafana.com/docs/grafana/latest/datasources/prometheus/#configure-the-data-source"
          target="_blank"
          rel="noopener noreferrer"
        >
          documentation
        </a>
        .
      </div>
    </>
  );
};
