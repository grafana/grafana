import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const API_KEY = 'b5e8046abc3f4817aba2c5a3f46b678b'; // Replace with your API key
const STOCK_SYMBOL = 'MSFT';
const INTERVAL = '5min'; // Fetch every 5 minutes

type StockDataPoint = {
  time: string;
  value: number;
};

export default function StockChart() {
  const [stockData, setStockData] = useState<StockDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stock data from API
  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('https://api.twelvedata.com/time_series', {
          params: {
            symbol: STOCK_SYMBOL,
            interval: INTERVAL,
            outputsize: 20, // Get last 20 points
            apikey: API_KEY,
          },
        });

        const data = response.data;
        if (data && data.values) {
          const formattedData = data.values
            .map((point: { datetime: string; close: string }) => ({
              time: point.datetime, // Keep as string for display
              value: parseFloat(point.close),
            }))
            .sort((a: StockDataPoint, b: StockDataPoint) => new Date(a.time).getTime() - new Date(b.time).getTime()); // Sort in ascending order

          setStockData(formattedData);
          setError(null);
        } else {
          throw new Error('No stock data found');
        }
      } catch (err) {
        setError('Failed to fetch stock data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
    const interval = setInterval(fetchStockData, 10000 * 60 *1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', height: '400px', padding: '20px', textAlign: 'center' }}>
      <h2>📈 Microsoft (MSFT) Stock Prices</h2>

      {loading && <p>⏳ Loading stock data...</p>}
      {error && <p style={{ color: 'red' }}>⚠️ {error}</p>}

      {!loading && !error && stockData.length > 0 && (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={stockData}>
            <XAxis dataKey="time" tickFormatter={(tick: string) => tick.substring(11, 16)} />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <CartesianGrid strokeDasharray="3 3" />
            <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
