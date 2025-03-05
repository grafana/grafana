/*interface MappedEntry {
    time: number;
    value: number;
}

export async function fetchDataFromAPI(): Promise<MappedEntry[]> {
    const response = await fetch('https://api.publicapis.org/entries'); // Replace with your API endpoint
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    interface APIEntry {
        API: string;
        Description: string;
        Auth: string;
        HTTPS: boolean;
        Cors: string;
        Link: string;
        Category: string;
    }


    const entries: { entries: APIEntry[] } = data;
    return entries.entries.map(entry => ({
        time: new Date(entry.API).getTime(), // Mock time data
        value: Math.random() * 100, // Mock value data
    }));
}*/

/*
export async function fetchDataFromJSON() {
    const response = await fetch('./mydata.json'); // Replace with the path to your JSON file
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data;
  }*/