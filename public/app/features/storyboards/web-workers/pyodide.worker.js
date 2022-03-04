if ('function' === typeof importScripts) {
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.17.0/full/pyodide.js');

  async function loadPyodideAndPackages() {
    await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.17.0/full/' });
    await self.pyodide.loadPackage(['numpy', 'pandas', 'pytz']);
    await self.pyodide.runPythonAsync(`

    import sys
    from io import StringIO
    sys.stdout = StringIO()
    sys.stderr = StringIO()

    def fromDF(df):
      import pandas
      return pandas.DataFrame({
        field.name: list(field.values)
        for field in df[0].fields
      }).assign(Time=lambda x: pandas.to_datetime(x.Time, unit="ms"))

    def toDF(df):
      import json
      import pandas as pd
      fields = []
      try:
        time_col = [c for c in df.columns if c.lower() == "time"][0]
      except IndexError:
        raise ValueError("No column named 'time' found!")
      time_values = (df[time_col] - pd.Timestamp("1970-01-01")) // pd.Timedelta("1ms")
      fields.append({"name": "Time", "values": time_values.tolist()})
      for col in df.columns:
        if col != time_col:
          fields.append({"name": col, "values": df[col].tolist()})
      return json.dumps({"fields": fields})`);
  }
  let pyodideReadyPromise = loadPyodideAndPackages();

  self.onmessage = async (event) => {
    await pyodideReadyPromise;
    const { python, ...context } = event.data;

    for (const key of Object.keys(context)) {
      console.log('Loading %s: %o', key, context[key]);
      if (context[key]) {
        self[key] = context[key].value;
      }
    }

    try {
      const results = await self.pyodide.runPythonAsync(python);
      const stdout = self.pyodide.runPython(
        'import sys; out = sys.stdout.getvalue(); sys.stdout.truncate(0);sys.stdout.seek(0); out'
      );
      console.info('WORKER RESULT: %o, (%o)', results, stdout);
      self.postMessage({
        results,
        stdout,
      });
    } catch (error) {
      console.error('ERROR: %o, (%o)', error);
      self.postMessage({ error: error.message });
    }
  };
}
