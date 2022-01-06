import { useEffect, useState } from 'react';
import { cloneDeep } from 'lodash';
import { DEFAULT_ID, DEFAULT_TS_NS, DEFAULT_LINE, DEFAULT_TS } from './constants';
import { ArrayVector } from '../../../../../packages/grafana-data';

interface Props {
  data: any;
}

interface ExternalLog {
  msg: string;
  timestamp: number;
}

interface Field {
  values: ArrayVector;
}

const usePopulateData = ({ data }: Props) => {
  const [newData, setNewData] = useState(data);
  const [externalLogs, setExternalLogs] = useState<ExternalLog[]>([]);

  const addMessageToData = (data: any, log: ExternalLog) => {
    data.series = data.series || [];

    const lastFrame = data.series.length - 1;
    const index = lastFrame < 0 ? 0 : lastFrame;

    data.series[index] = data.series[index] || {};

    const series = data.series[index];
    series.fields = series.fields || [];

    const fields = series.fields;

    fields[0] = fields[0] || DEFAULT_TS;
    fields[1] = fields[1] || DEFAULT_LINE;
    fields[2] = fields[2] || DEFAULT_ID;
    fields[3] = fields[3] || DEFAULT_TS_NS;

    const ts = fields[0] as Field;
    const line = fields[1] as Field;
    const id = fields[2] as Field;
    const tsNs = fields[3] as Field;

    ts.values.add(new Date(log.timestamp).toISOString());
    line.values.add(log.msg);
    id.values.add(log.timestamp);
    tsNs.values.add(log.timestamp);

    series.length = series.length ? series.length + 1 : 1;

    return data;
  };

  useEffect(() => {
    let clonedData = cloneDeep(data);
    externalLogs.forEach((log: ExternalLog) => {
      clonedData = addMessageToData(clonedData, log);
    });
    setNewData(clonedData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    const postMessage = ({ data }: any) => {
      let msg = '';
      try {
        msg = JSON.parse(data || '{}');
      } catch (e) {
        msg = data || '';
      }
      const logs: ExternalLog[] = [...externalLogs];
      const newLog: ExternalLog = {
        msg,
        timestamp: Date.now(),
      };
      logs.push(newLog);
      setExternalLogs(logs);
      const clonedData = cloneDeep(newData);
      const updatedData = addMessageToData(clonedData, newLog);
      setNewData(updatedData);
    };

    window.addEventListener('message', postMessage);

    return () => {
      window.removeEventListener('message', postMessage);
    };
  }, [newData, externalLogs]);

  return {
    newData,
    externalLogs,
  };
};

export default usePopulateData;
