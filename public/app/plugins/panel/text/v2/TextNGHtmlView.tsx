import { TextSandbox } from './TextSandbox';

interface Props {
  html: string;
  className?: string;
  testId?: string;
  hasData?: boolean;
}

/** Shared by the panel and the edit-time preview so they can't diverge. */
export function TextNGHtmlView({ hasData = false, ...props }: Props) {
  return <TextSandbox {...props} hasData={hasData} />;
}
