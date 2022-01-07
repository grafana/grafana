import { useEffect, useState } from 'react';
import { cloneDeep } from 'lodash';

interface Props {
  data: any;
}

const useNewData = ({ data }: Props) => {
  const [newData, setNewData] = useState(data);
  const [externalLogs, setExternalLogs] = useState<any>([]);

  const addMessageToData = (data: any, msg: string, timestamp: number) => {
    const lastFrame = data.series.length - 1;
    const fields = data.series[lastFrame].fields;
    const time = fields[0];
    const message = fields[1];
    const containerId = fields[2];
    const hostname = fields[3];
    //@ts-ignore
    time.values.add(timestamp);
    //@ts-ignore
    message.values.add(msg);
    //@ts-ignore
    containerId.values.add('fusebit');
    //@ts-ignore
    hostname.values.add('fusebit');
    data.series[lastFrame].length++;
    return data;
  };

  useEffect(() => {
    let clonedData = cloneDeep(data);
    externalLogs.forEach((log: any) => {
      clonedData = addMessageToData(clonedData, JSON.stringify(log.msg), log.timestamp);
    });
    setNewData(clonedData);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    const postMessage = (msg: any) => {
      const logs = [...externalLogs];
      logs.push({ msg: msg.data, timestamp: Date.now() });
      setExternalLogs(logs);
      const clonedData = cloneDeep(newData);
      const updatedData = addMessageToData(clonedData, msg.data, Date.now());
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

export default useNewData;
