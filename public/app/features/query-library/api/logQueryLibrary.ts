export const logQueryLibrary = (type: string, recordCount: number, duration: number) => {
  fetch('http://localhost:3001/queryLibrary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, recordCount, duration }),
  });
};
