import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';

import { LoadingState, toDataFrame } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome, useTheme2, LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getNavModel } from '../../core/selectors/navModel';
import { StoreState } from '../../types';

export interface XPageRouteParams {
  searchQuery?: string;
}

interface Props extends GrafanaRouteComponentProps<XPageRouteParams> {}
export function XPage({ match }: Props) {
  const [search, setSearch] = useState(match?.params?.searchQuery || `What's happening...?`);
  const [dashboard, setDashboard] = useState<{
    panels: Array<{ title: string; pluginId: string; options?: unknown; fieldConfig?: unknown; data?: unknown }>;
  }>({
    panels: [],
  });
  const theme = useTheme2();
  useEffect(() => {
    fetch(`/api/x?query=${encodeURIComponent(match?.params?.searchQuery || '')}`)
      .then((res) => res.json())
      .then((res) => setDashboard(res));
  }, [match?.params?.searchQuery]);
  return (
    <>
      <Page navId="x" hidden>
        <Page.Contents>X</Page.Contents>
      </Page>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignContent: 'center',
          alignItems: 'center',
          backgroundImage: 'url(https://grafana.com/about/events/grafanacon/assets/2021/bg-starfield-lg.svg)',
          gap: 10,
          paddingTop: theme.spacing(6),
          paddingBottom: theme.spacing(6),
          margin: theme.spacing(1),
        }}
      >
        <img
          src="https://grafana.com/about/events/grafanacon/assets/2021/grafana-constellation.svg"
          alt=""
          width={38 * 3}
          height={38 * 3}
          style={{ marginInlineEnd: '100px' }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignContent: 'center',
            alignItems: 'center',
            paddingBottom: '20px',
            // borderBottom: '1px solid white',
            gap: 20,
          }}
        >
          <br />
          <input
            placeholder={"What's up...?"}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
            }}
            style={{
              marginInline: '60px',
              height: '60px',
              fontSize: '40px',
              fontWeight: 'bolder',
              color: 'white',
              outline: 'none',
              background: 'transparent',
              textAlign: 'center',
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <LinkButton variant="secondary" icon="search" fill="outline" href={`/x/${search}`}>
            Search
          </LinkButton>
        </div>

        <img
          src="https://grafana.com/about/events/grafanacon/assets/2023/graphic-golden-grot4.svg"
          alt=""
          width={38 * 3}
          height={26 * 3}
          style={{ marginInlineStart: '100px' }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing(1),
          padding: theme.spacing(1),
        }}
      >
        {dashboard?.panels.map((p, idx) => (
          <div key={idx} style={{}}>
            <PanelChrome
              displayMode="transparent"
              title={p.title}
              width={theme.spacing.gridSize * 54}
              height={200}
              loadingState={LoadingState.Done}
              // menu={() => <>menu</>}
            >
              {(innerWidth, innerHeight) => (
                <PanelRenderer
                  data={{
                    series: [toDataFrame(p.data || [{ value: 1 }])],
                    state: LoadingState.Done,
                    timeRange: { from: 0, to: 0, raw: { from: '0', to: '1' } },
                  }}
                  pluginId={p.pluginId || 'text'}
                  title={p.title || ''}
                  fieldConfig={p.fieldConfig}
                  options={p.options || { mode: 'markdown', content: '# hello world' }}
                  width={innerWidth}
                  height={innerHeight}
                />
              )}
            </PanelChrome>
          </div>
        ))}
      </div>
    </>
  );
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'x'),
});

export default connect(mapStateToProps)(XPage);
