import { useEffect, useState } from 'react';
import { cloneDeep } from 'lodash';
import { ArrayVector } from '@grafana/data';

interface Props {
  data: any;
}

interface ExternalLog {
  msg: string;
  timestamp: number;
}

const usePopulateData = ({ data }: Props) => {
  const [newData, setNewData] = useState(data);
  const [externalLogs, setExternalLogs] = useState<ExternalLog[]>([]);

  const addMessageToData = (data: any, log: ExternalLog) => {
    const lastFrame = data.series.length - 1;
    const fields = data.series[lastFrame].fields;

    if (!fields[0] || !fields[1] || !fields[2] || !fields[3]) {
      const timeInitData = {
        name: 'ts',
        type: 'time',
        values: new ArrayVector([]),
        config: {
          displayName: 'Time',
        },
      };

      const messageInitdata = {
        name: 'line',
        type: 'string',
        values: new ArrayVector([]),
        config: {},
      };

      const containerIdInitData = {
        name: 'id',
        type: 'string',
        values: new ArrayVector([]),
        config: {},
      };

      const hostnameInitData = {
        name: 'tsNs',
        type: 'time',
        values: new ArrayVector([]),
        config: {
          displayName: 'Time ns',
        },
      };

      const initData = [timeInitData, messageInitdata, containerIdInitData, hostnameInitData];

      for (let i = 0; i < 4; i++) {
        if (!fields[i]) {
          fields[i] = initData[i];
        }
      }
    }

    const time = fields[0];
    const message = fields[1];
    const containerId = fields[2];
    const hostname = fields[3];

    //@ts-ignore
    time.values.add(log.timestamp);
    //@ts-ignore
    message.values.add(log.msg);
    //@ts-ignore
    containerId.values.add(log.timestamp);
    //@ts-ignore
    hostname.values.add(log.msg);

    data.series[lastFrame].length++;

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
      const msg = JSON.stringify(data);
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
