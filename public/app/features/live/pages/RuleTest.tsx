import { css } from '@emotion/css';
import React, { useState } from 'react';

import { dataFrameFromJSON, getDisplayProcessor } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { Button, CodeEditor, Table, Field } from '@grafana/ui';

import { ChannelFrame, Rule } from './types';

interface Props {
  rule: Rule;
}

export const RuleTest = (props: Props) => {
  const [response, setResponse] = useState<ChannelFrame[]>();
  const [data, setData] = useState<string>();

  const onBlur = (text: string) => {
    setData(text);
  };

  const onClick = () => {
    getBackendSrv()
      .post(`api/live/pipeline-convert-test`, {
        channelRules: [props.rule],
        channel: props.rule.pattern,
        data: data,
      })
      .then((data: any) => {
        const t = data.channelFrames as any[];
        if (t) {
          setResponse(
            t.map((f) => {
              const frame = dataFrameFromJSON(f.frame);
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
    <div>
      <CodeEditor
        height={100}
        value=""
        showLineNumbers={true}
        readOnly={false}
        language="json"
        showMiniMap={false}
        onBlur={onBlur}
      />

      <Button onClick={onClick} className={styles.margin}>
        Test
      </Button>

      {response?.length &&
        response.map((r) => (
          <Field key={r.channel} label={r.channel}>
            <Table data={r.frame} width={700} height={Math.min(10 * r.frame.length + 10, 150)} showTypeIcons></Table>
          </Field>
        ))}
    </div>
  );
};

const styles = {
  margin: css`
    margin-bottom: 15px;
  `,
};
