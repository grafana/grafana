export interface OrgDetailsDTO {
  id: number;
  name: string;
  address: {
    address1: string;
    address2: string;
    city: string;
    zipCode: string;
    state: string;
    country: string;
  };
}
