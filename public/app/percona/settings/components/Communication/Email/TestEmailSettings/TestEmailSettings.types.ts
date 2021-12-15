export interface TestEmailSettingsProps {
  onTest: (email: string) => Promise<void>;
  onInput?: (email: string) => void;
  initialValue?: string;
}
