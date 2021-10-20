import React, { useState, useEffect } from 'react';
import { Button, CodeEditor, Table, useStyles, Select, Field } from '@grafana/ui';
import { ChannelFrame, Rule } from './types';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { getBackendSrv, config } from '@grafana/runtime';
import { css } from '@emotion/css';
import { getDisplayProcessor, GrafanaTheme, StreamingDataFrame } from '@grafana/data';
import { transformLabel } from './utils';

export default function RuleTest() {
  const navModel = useNavModel('live-test');
  const [response, setResponse] = useState<ChannelFrame[]>();
  const [data, setData] = useState<string>();
  const [rules, setRules] = useState<Rule[]>([]);
  const [channelRules, setChannelRules] = useState<Rule[]>();
  const [channelSelected, setChannelSelected] = useState<string>();
  const styles = useStyles(getStyles);
  useEffect(() => {
    getBackendSrv()
      .get(`api/live/channel-rules`)
      .then((data) => {
        setRules(data.rules);
      })
      .catch((e) => {
        if (e.data) {
          console.log(e);
        }
      });
  }, []);

  const onBlur = (text: string) => {
    setData(text);
  };

  const onClick = () => {
    getBackendSrv()
      .post(`api/live/pipeline-convert-test`, {
        channelRules: channelRules,
        channel: channelSelected,
        data: data,
      })
      .then((data: any) => {
        const t = data.channelFrames as any[];
        if (t) {
          setResponse(
            t.map((f) => {
              const frame = new StreamingDataFrame(f.frame);
              for (const field of frame.fields) {
                field.display = getDisplayProcessor({ field, theme: config.theme2 });
              }
              return { channel: f.channel, frame };
            })
          );
        }
      })
      .catch((e) => {
        setResponse(e);
      });
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <Field label="Channel">
          <Select
            menuShouldPortal
            options={transformLabel(rules, 'pattern')}
            value=""
            onChange={(v) => {
              setChannelSelected(v.value);
              setChannelRules(rules.filter((r) => r.pattern === v.value));
            }}
            placeholder="Select Channel"
          />
        </Field>
        <Field label="Data">
          <CodeEditor
            height={200}
            value=""
            showLineNumbers={true}
            readOnly={false}
            language="json"
            showMiniMap={false}
            onBlur={onBlur}
          />
        </Field>
        <Button onClick={onClick} className={styles.margin}>
          Test
        </Button>

        {response?.length &&
          response.map((r) => (
            <Field key={r.channel} label={r.channel}>
              <Table data={r.frame} width={650} height={10 * r.frame.length + 10} showTypeIcons></Table>
            </Field>
          ))}
      </Page.Contents>
    </Page>
  );
}
const getStyles = (theme: GrafanaTheme) => {
  return {
    margin: css`
      margin-bottom: 15px;
    `,
  };
};
