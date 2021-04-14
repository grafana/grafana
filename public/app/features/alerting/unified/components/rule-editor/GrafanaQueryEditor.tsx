import { TextArea } from '@grafana/ui';
import { GrafanaQuery } from 'app/types/unified-alerting-dto';
import React, { FC, useState } from 'react';

interface Props {
  value?: GrafanaQuery[];
  onChange: (value: GrafanaQuery[]) => void;
}

// @TODO replace with actual query editor once it's done
export const GrafanaQueryEditor: FC<Props> = ({ value, onChange }) => {
  const [content, setContent] = useState(JSON.stringify(value || [], null, 2));
  const onChangeHandler = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const val = (e.target as HTMLTextAreaElement).value;
    setContent(val);
    try {
      const parsed = JSON.parse(val);
      if (parsed && Array.isArray(parsed)) {
        console.log('queries changed');
        onChange(parsed);
      }
    } catch (e) {
      console.log('invalid json');
    }
  };
  return <TextArea rows={20} value={content} onChange={onChangeHandler} />;
};
