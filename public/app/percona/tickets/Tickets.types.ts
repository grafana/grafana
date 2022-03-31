export interface Ticket {
  number: string;
  shortDescription: string;
  priority: string;
  state: string;
  createTime: string;
  department: string;
  taskType: string;
  url: string;
}

export interface RawTicket {
  number: string;
  short_description: string;
  priority: string;
  state: string;
  create_time: string;
  department: string;
  task_type: string;
  url: string;
}

export interface TicketResponse {
  tickets: RawTicket[];
}
