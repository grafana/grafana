/*import React, { useState, useEffect } from 'react';
import { Alert } from '@grafana/ui';

function StockAnomalyDetector() {
  const stockData: number[] = [100, 102, 105, 150, 107, 109]; // Simulated stock data
  const [alertMessage, setAlertMessage] = useState<string>('');

  useEffect(() => {
    detectAnomaly(stockData);
  }, []);

  const detectAnomaly = (data: number[]) => {
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(data[i] - data[i - 1]) > 20) { // Example threshold
        setAlertMessage(`Anomaly detected at index ${i}: Sudden change from ${data[i - 1]} to ${data[i]}`);
        return;
      }
    }
    setAlertMessage('');
  };

  return (
    <div>
      <h2>Stock Anomaly Detector</h2>
      {alertMessage && <Alert title="Anomaly Alert!" severity="error">{alertMessage}</Alert>}
    </div>
  );
}

export default StockAnomalyDetector;
*/



import React, { useState, useEffect } from 'react';
import { Alert } from '@grafana/ui';

function StockAnomalyDetector() {
  const [alertMessage, setAlertMessage] = useState<string>('');

  useEffect(() => {
    const mockStockData = [100, 102, 105, 150, 107, 109, 200, 95, 110, 90];
    let index = 0;

    const simulateStockUpdates = () => {
      if (index < mockStockData.length) {
        detectAnomaly(mockStockData[index]);
        index++;
      } else {
        index = 0;
      }
    };

    const interval = setInterval(simulateStockUpdates, 3000); // Simulate data every 3 seconds
    return () => clearInterval(interval);
  }, []);

  let lastPrice: number | null = null;

  const detectAnomaly = (price: number) => {
    if (lastPrice !== null && Math.abs(price - lastPrice) > 15) { // Example threshold
      setAlertMessage(`Anomaly detected: Sudden change from ${lastPrice} to ${price}`);
      setTimeout(() => setAlertMessage(''), 4000); // Hide alert after 4 seconds
    }
    lastPrice = price;
  };

  return (
    <div>
      <h2>Stock Anomaly Detector</h2>
      {alertMessage && <Alert title="Anomaly Alert!" severity="error">{alertMessage}</Alert>}
    </div>
  );
}

export default StockAnomalyDetector;

