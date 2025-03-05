const fs = require('fs');
const axios = require('axios');

// 🔹 Replace 'YOUR_API_KEY' with your Twelve Data API Key
const API_KEY = 'b5e8046abc3f4817aba2c5a3f46b678b';
const SYMBOL = 'MSFT'; // Microsoft stock symbol
const INTERVAL = '5min'; // Fetch data every 5 minutes
const JSON_FILE = './mydata.json';

// Fetch stock price from Twelve Data API
async function fetchStockPrice() {
    try {
        const response = await axios.get(`https://api.twelvedata.com/time_series`, {
            params: {
                symbol: SYMBOL,
                interval: INTERVAL,
                outputsize: 1,
                apikey: API_KEY,
            },
        });

        const data = response.data;
        if (data && data.values && data.values.length > 0) {
            const latestData = data.values[0]; // Most recent stock price
            const stockPrice = parseFloat(latestData.close); // Closing price
            const timestamp = new Date(latestData.datetime).toISOString(); // ISO timestamp

            console.log(`✅ Fetched MSFT Stock Price: $${stockPrice} at ${timestamp}`);

            // Save data to JSON
            await saveStockData(timestamp, stockPrice);
        } else {
            console.error('❌ No stock data found.');
        }
    } catch (error) {
        console.error('❌ Error fetching stock price:', error.message);
    }
}

// Save stock price data to JSON file
async function saveStockData(time, value) {
    let jsonData = [];

    // Load existing data (if any)
    if (fs.existsSync(JSON_FILE)) {
        const fileData = fs.readFileSync(JSON_FILE, 'utf8');
        jsonData = JSON.parse(fileData);
    }

    // Format data according to required structure
    if (jsonData.length === 0) {
        jsonData.push({ name: 'Microsoft Stock Price', values: [] });
    }

    // Append new data
    jsonData[0].values.push({ time, value });

    // Save back to file
    fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2));
    console.log(`✅ Saved data to ${JSON_FILE}`);

    // Print last 5 stock prices
    console.log('📊 Last 5 Recorded Prices:');
    const last5Prices = jsonData[0].values.slice(-5); // Get last 5 entries
    last5Prices.forEach((entry, index) => {
        console.log(`${index + 1}. Time: ${entry.time}, Price: $${entry.value}`);
    });
    console.log('--------------------------------------');
}

// Fetch stock price immediately & every 5 minutes
fetchStockPrice(); // Run immediately
setInterval(fetchStockPrice, 5 * 60 ); // ✅ Fix timing: 5 minutes
