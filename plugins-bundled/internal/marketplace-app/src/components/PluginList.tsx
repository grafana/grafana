import React from 'react';

import { Card } from '../components/Card';
import { Grid } from '../components/Grid';
import { useTheme } from '@grafana/ui';
import { css } from 'emotion';
import { PLUGIN_ROOT } from '../constants';
import { Plugin } from '../types';

interface Props {
  plugins: Plugin[];
}

export const PluginList = ({ plugins }: Props) => {
  const theme = useTheme();

  return (
    <Grid>
      {plugins.map((plugin) => {
        const { name, slug, version, orgName } = plugin;

        return (
          <a key={`${orgName}-${name}`} href={`${PLUGIN_ROOT}?tab=plugin&slug=${slug}`}>
            <Card>
              <div
                className={css`
                  display: flex;
                  flex-direction: column;
                  justify-content: space-around;
                  height: 100%;
                `}
              >
                <div
                  className={css`
                    flex-grow: 1;
                    padding: ${theme.spacing.sm} 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                  `}
                >
                  <img
                    src={`https://grafana.com/api/plugins/${slug}/versions/${version}/logos/small`}
                    className={css`
                      max-height: 64px;
                    `}
                  />
                </div>
                <div
                  className={css`
                    font-size: ${theme.typography.size.lg};
                    color: ${theme.colors.text};
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-align: center;
                  `}
                >
                  {name}
                </div>
                <div
                  className={css`
                    font-size: ${theme.typography.size.md};
                    color: ${theme.colors.textSemiWeak};
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-align: center;
                  `}
                >
                  {orgName}
                </div>
              </div>
            </Card>
          </a>
        );
      })}
    </Grid>
  );
};
