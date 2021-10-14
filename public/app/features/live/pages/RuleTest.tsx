import React, { useState } from 'react';
import { Button, CodeEditor, Label, Table, useStyles } from '@grafana/ui';
import { ChannelFrame, Rule } from './types';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme, StreamingDataFrame } from '@grafana/data';

interface ReqBody {
  channelRules: Rule[];
  channel: string;
  data: string;
}
export default function RuleTest() {
  const navModel = useNavModel('live-test');
  const [response, setResponse] = useState<ChannelFrame[]>();
  const [body, setBody] = useState<ReqBody>();
  const styles = useStyles(getStyles);

  const onBlur = (text: string) => {
    setBody(JSON.parse(text));
  };
  const onClick = () => {
    getBackendSrv()
      .post(`api/live/pipeline-convert-test`, {
        channelRules: body?.channelRules,
        channel: body?.channel,
        data: body?.data,
      })
      .then((data: any) => {
        const t = data.channelFrames as any[];
        if (t) {
          setResponse(t.map((f) => ({ channel: f.channel, frame: new StreamingDataFrame(f.frame) })));
        }
      })
      .catch((e) => {
        setResponse(e);
      });
  };
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <Label>JSON Content</Label>
        <CodeEditor
          height="25vh"
          value=""
          showLineNumbers={true}
          readOnly={false}
          language="json"
          showMiniMap={false}
          onBlur={onBlur}
        />
        <Button onClick={onClick} className={styles.testButton}>
          Test
        </Button>
        {response?.length && (
          <div>
            <Label>Reponse</Label>
            {response.map((r) => (
              <div key={r.channel}>
                <Label>{r.channel}</Label>
                <Table data={r.frame} width={500} height={400} showTypeIcons></Table>
                <pre>{JSON.stringify(r.frame, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}
const getStyles = (theme: GrafanaTheme) => {
  return {
    testButton: css`
      margin-top: 5px;
      margin-bottom: 5px;
    `,
  };
};
