type FieldsDefinition = {
  name: string;
  // String type, usually something like 'string' or 'float'.
  type: string;
};
type Measurements = { [measurement: string]: FieldsDefinition[] };
type FieldReturnValue = { text: string };

export class InfluxDatasourceMock {
  constructor(private measurements: Measurements) {}
  metricFindQuery(query: string) {
    if (isMeasurementsQuery(query)) {
      return this.getMeasurements();
    } else {
      return this.getMeasurementFiels(query);
    }
  }

  private getMeasurements(): FieldReturnValue[] {
    return Object.keys(this.measurements).map(key => ({ text: key }));
  }

  private getMeasurementFiels(query: string): FieldReturnValue[] {
    const match = query.match(/SHOW FIELD KEYS FROM \"(.+)\"/);
    if (!match) {
      throw new Error(`Failed to match query="${query}"`);
    }
    const measurementName = match[1];
    if (!measurementName) {
      throw new Error(`Failed to match measurement name from query="${query}"`);
    }

    const fields = this.measurements[measurementName];
    if (!fields) {
      throw new Error(
        `Failed to find measurement with name="${measurementName}" in measurements="[${Object.keys(
          this.measurements
        ).join(', ')}]"`
      );
    }

    return fields.map(field => ({
      text: field.name,
    }));
  }
}

function isMeasurementsQuery(query: string) {
  return /SHOW MEASUREMENTS/.test(query);
}
