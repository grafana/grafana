export interface BaselineDTO {
  id: string;
  startDate: string;
  endDate: string;
  noOfDays?: string;
  kwh: string;
  minKw: string;
  maxKw: string;
  avgKw: string;
  avgKva: string;
  pf: string;
  minPf: string;
  maxPf: string;
  rate: string;
  energyRate: string;
  fuelRate: string;
  ippRate: string;
  ippVariableRate: string;
  ippVariableCharge: string;
  energyCharge: string;
  currentCharges: string;
}
