import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { ConfigSection } from '@grafana/experimental';
import { InlineField, Input, PopoverContent } from '@grafana/ui';

import { PromOptions } from '../../types';
// THIS FILE IS COPIED FROM GRAFANA/EXPERIMENTAL
// BECAUSE IT CONTAINS TYPES THAT ARE REQUIRED IN THE ADVANCEDHTTPSETTINGS COMPONENT
// THE TYPES ARE WRITTEN IN EXPERIMENTAL WHERE THEY ARE NOT AS STRICT
// @ts-ignore
export type Config<JSONData extends DataSourceJsonData, SecureJSONData> = DataSourceSettings<
  // @ts-ignore
  JSONData,
  // @ts-ignore
  SecureJSONData
>;
// @ts-ignore
export type OnChangeHandler<C extends Config = Config> = (options: DataSourceSettings<PromOptions, {}>) => void;
// @ts-ignore
export type Props<C extends Config = Config> = {
  config: C;
  onChange: OnChangeHandler<C>;
  description?: ReactNode;
  urlPlaceholder?: string;
  urlTooltip?: PopoverContent;
  urlLabel?: string;
  className?: string;
};
// @ts-ignore
export const ConnectionSettings: <C extends Config = Config>(props: Props<C>) => JSX.Element = ({
  config,
  onChange,
  description,
  urlPlaceholder,
  urlTooltip,
  urlLabel,
  className,
}) => {
  const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(
    config.url
  );

  const styles = {
    container: css({
      maxWidth: 578,
    }),
  };

  return (
    <>
      <ConfigSection title="Connection" description={description} className={cx(styles.container, className)}>
        <InlineField
          htmlFor="connection-url"
          label={urlLabel || 'URL'}
          labelWidth={24}
          tooltip={
            urlTooltip || (
              <>
                Specify a complete HTTP URL
                <br />
                (for example https://example.com:8080)
              </>
            )
          }
          grow
          disabled={config.readOnly}
          required
          invalid={!isValidUrl && !config.readOnly}
          error={isValidUrl ? '' : 'Please enter a valid URL'}
          interactive
        >
          <Input
            id="connection-url"
            aria-label="Datasource HTTP settings url"
            onChange={(event) =>
              onChange({
                ...config,
                url: event.currentTarget.value,
              })
            }
            value={config.url || ''}
            placeholder={urlPlaceholder || 'URL'}
          />
        </InlineField>
      </ConfigSection>
    </>
  );
};
