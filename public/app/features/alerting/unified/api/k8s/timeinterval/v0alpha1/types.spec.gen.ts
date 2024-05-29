export interface Spec {
  time_intervals: Array<{
    times?: Array<{
      start_time: string;
      end_time: string;
    }>;
    weekdays?: string[];
    days_of_month?: string[];
    months?: string[];
    years?: string[];
    location?: string;
  }>;
}

export const defaultSpec: Partial<Spec> = {
  time_intervals: [],
};
