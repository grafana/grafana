export interface LiveNotice {
  time: number;
  kind?: string;
  title?: string;
  body?: string;
  severity?: string;
}

export interface LiveNotices {
  notice: LiveNotice[];
}
