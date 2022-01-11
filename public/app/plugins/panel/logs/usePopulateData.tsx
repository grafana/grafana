import { useEffect, useState } from 'react';
import { cloneDeep } from 'lodash';

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
    const time = fields[0];
    const message = fields[1];
    const containerId = fields[2];
    const hostname = fields[3];
    //@ts-ignore
    time.values.add(log.timestamp);
    //@ts-ignore
    message.values.add(log.msg);
    //@ts-ignore
    containerId.values.add('fusebit');
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
