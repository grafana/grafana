import { useEffect, useState } from 'react';
import { cloneDeep } from 'lodash';
import { DEFAULT_ID, DEFAULT_TS_NS, DEFAULT_LINE, DEFAULT_TS, DEFAULT_TRACEID, DEFAULT_SPANID } from './constants';

interface Props {
  data: any;
}

interface ExternalLog {
  msg: string;
  traceId?: string;
  spanId?: string;
  timestamp: number;
}

const usePopulateData = ({ data }: Props) => {
  const [newData, setNewData] = useState(data);
  const [externalLogs, setExternalLogs] = useState<ExternalLog[]>([]);

  const addMessageToData = (data: any, log: ExternalLog) => {
    data.series = data.series || [];

    const frame: any = {
      fields: [
        DEFAULT_TS(new Date(log.timestamp).toISOString()),
        DEFAULT_LINE(log),
        DEFAULT_ID(log.timestamp),
        DEFAULT_TS_NS(log.timestamp),
      ],
      length: 1,
      refId: 'A',
    };

    if (log.traceId) {
      frame.fields.push(DEFAULT_TRACEID(log.traceId));
    }

    if (log.spanId) {
      frame.fields.push(DEFAULT_SPANID(log.spanId));
    }

    data.series.push(frame);

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
      let payload: { msg: string; traceId?: string; spanId?: string };
      try {
        payload = JSON.parse(data || '{}');
      } catch (e) {
        payload = { msg: data || '' };
      }

      const logs: ExternalLog[] = [...externalLogs];
      const newLog: ExternalLog = {
        ...payload,
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
