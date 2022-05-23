export interface CustomerSuccessResponse {
  customer_success: {
    name: string;
    email: string;
  };
  new_ticket_url: string;
}

export interface CustomerSuccess {
  name: string;
  email: string;
  newTicketUrl: string;
}
