---
aliases:
  - 
keywords:
  - grafana
  - https
  - ssl
  - certificates
title: Set up Grafana HTTPS for Secure Web Traffic
weight: 900
---

# Set up Grafana HTTPS for Secure Web Traffic

The Grafana UI is accessed through the web. Setting up HTTPS ensures that
communication going back and forth between Grafana and the end user is encrypted, to include
login information and metric data.

In order to accomplish this, Grafana needs a key to use for encrypting the traffic, and a
[Secure Socket Layer (SSL) certificate](https://www.kaspersky.com/resource-center/definitions/what-is-a-ssl-certificate) that helps establish the identity of the site. With these two things, 
users can see the proper browser "lock icon" indicating their connection is secure.

![secure HTTPS connection](/media/docs/grafana/https-config/screenshot-secure-https.png)

This page will outline how to:

1. Obtain a certificate and key
2. Configure Grafana HTTPS
3. Restart the Grafana server

## Obtain a Certificate and Key

There are two different methods of accomplishing this, depending on your needs. The
_self-signed_ method is faster and easier, but results in browser warnings the end user
will see. The Certificate Authority (CA) signed
approach requires extra steps, but enables full browser trust.  If you would like to
read a full treatment of the difference between these approaches,
[it can be found here](https://www.baeldung.com/cs/self-signed-ca-vs-certificate). You
should choose only one of the next two sections to follow.

### Generating a Self-Signed Certificate

In this section we will use `openssl` tooling to generate all necessary files from 
the command line.  

```bash
$ sudo openssl genrsa -out /etc/grafana/grafana.key 2048
```


```bash
$ sudo openssl req -new -key /etc/grafana/grafana.key -out /etc/grafana/grafana.csr
```

Answer the questions when prompted, which will include your fully-qualified domain name, 
email address, country code, and others, which will look like this:

```
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [AU]:US
State or Province Name (full name) [Some-State]:Virginia
Locality Name (eg, city) []:Richmond
Organization Name (eg, company) [Internet Widgits Pty Ltd]:
Organizational Unit Name (eg, section) []:
Common Name (e.g. server FQDN or YOUR name) []:subdomain.mysite.com
Email Address []:me@mysite.com

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:
An optional company name []:
```

```bash
sudo openssl x509 -req -days 365 -in grafana.csr -signkey /etc/grafana/grafana.key -out /etc/grafana/grafana.crt
```

Set appropriate permissions for files

```bash
sudo chown grafana:grafana /etc/grafana/grafana.crt
sudo chown grafana:grafana /etc/grafana/grafana.key
sudo chmod 400 grafana.key /etc/grafana/grafana.crt
```

> **Note**: proceeding with these files, browsers
will provide warnings for the resulting website because the certificate is not trusted
by a third-party source. Browsers will display trust warnings similar to the following; 
but the connection will still be encrypted.

![insecure HTTPS connection](/media/docs/grafana/https-config/screenshot-insecure-https.png)


### Getting a Signed Certificate from LetsEncrypt

[LetsEncrypt](https://letsencrypt.org/) is a nonprofit certificate authority that provides certificates
without charge. There are many companies and certificate authorities (CAs) who can provide signed
certificates. While there are many differences between how to generate those depending on the provider,
the principles are similar.  We use LetsEncrypt as an example in this section, because it is a free
option everyone can use.

> **Note**: the instructions in this section assume a Debian-based linux; support for other
distributions and OSs can be found in the [certbot instructions](https://certbot.eff.org/instructions).  Further, these instructions require you have a domain name you control. Dynamic domain
names such as those provided by Amazon EC2 or DynDNS providers will not work.

#### Install snapd and certbot

The `certbot` program is an OSS tool for automatically using LetsEncrypt certificates, and `snapd` is a tool that installs and runs `certbot` for us.

```bash
sudo apt-get install snapd
sudo snap install core; sudo snap refresh core
```

Before proceeding, ensure certbot is not installed on your system via a regular package manager,
because we will use it via snap.

```bash
sudo apt-get remove certbot
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

#### Generate Certificates with Certbot

We run the command `sudo certbot certonly --standalone`, which will prompt for the answer
to a few questions before generating the certificate.  This process will temporarily open a
service on port 80 that LetsEncrypt can use to verify communication with your host, so before
proceeding ensure that port 80 traffic is permitted by any applicable firewall rules.

```bash
$ sudo certbot certonly --standalone
Saving debug log to /var/log/letsencrypt/letsencrypt.log
Enter email address (used for urgent renewal and security notices)
 (Enter 'c' to cancel): me@mysite.com

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Please read the Terms of Service at
https://letsencrypt.org/documents/LE-SA-v1.3-September-21-2022.pdf. You must
agree in order to register with the ACME server. Do you agree?
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
(Y)es/(N)o: y

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Would you be willing, once your first certificate is successfully issued, to
share your email address with the Electronic Frontier Foundation, a founding
partner of the Let's Encrypt project and the non-profit organization that
develops Certbot? We'd like to send you email about our work encrypting the web,
EFF news, campaigns, and ways to support digital freedom.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
(Y)es/(N)o: n
Account registered.
Please enter the domain name(s) you would like on your certificate (comma and/or
space separated) (Enter 'c' to cancel): subdomain.mysite.com
Requesting a certificate for subdomain.mysite.com

Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/subdomain.mysite.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/subdomain.mysite.com/privkey.pem
This certificate expires on 2023-06-20.
These files will be updated when the certificate renews.
Certbot has set up a scheduled task to automatically renew this certificate in the background.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
If you like Certbot, please consider supporting our work by:
 * Donating to ISRG / Let's Encrypt:   https://letsencrypt.org/donate
 * Donating to EFF:                    https://eff.org/donate-le
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
```

#### Set up Symlinks to Grafana

```bash
$ sudo ln -s /etc/letsencrypt/live/subdomain.mysite.com/privkey.pem /etc/grafana/grafana.key
$ sudo ln -s /etc/letsencrypt/live/subdomain.mysite.com/fullchain.pem /etc/grafana/grafana.crt
```

#### Adjust Permissions

```bash
$ sudo chgrp -R grafana /etc/letsencrypt/*
$ sudo chmod -R g+rx /etc/letsencrypt/*
$ sudo chgrp -R grafana /etc/grafana/grafana.crt /etc/grafana/grafana.key 
$ sudo chmod 400 /etc/grafana/grafana.crt /etc/grafana/grafana.key
```

**Important**: verify that the `grafana` group can read the symlinks:

```bash
$ $ ls -l /etc/grafana/grafana.*
lrwxrwxrwx 1 root grafana    67 Mar 22 14:15 /etc/grafana/grafana.crt -> /etc/letsencrypt/live/subdomain.mysite.com/fullchain.pem
-rw-r----- 1 root grafana 54554 Mar 22 14:13 /etc/grafana/grafana.ini
lrwxrwxrwx 1 root grafana    65 Mar 22 14:15 /etc/grafana/grafana.key -> /etc/letsencrypt/live/subdomain.mysite.com/privkey.pem
```

## Configure Grafana HTTPS & Restart

Edit your `grafana.ini` configuration file to contain the following configuration parameters.  If you need help identifying where to find this file, or what each key means, refer to the [configuration reference documentation]({{< relref "./_index.md#configuration-file-location" >}}).

```
[server]
http_addr = 
http_port = 3000
domain = mysite.com
root_url = https://subdomain.mysite.com:3000
cert_key = /etc/grafana/grafana.key
cert_file = /etc/grafana/grafana.crt
enforce_domain = False
protocol = https
```

> **Note**: the standard port for SSL traffic is 443, which you may use instead of Grafana's default port 3000;
this may require additional operating system privileges or configuration to bind to lower-numbered privileged ports.

After saving the configuration file, you will need to 
[restart the Grafana server]({{< relref "./installation/debian/_index.md#2-start-the-server" >}}) using
systemd, init.d, or the binary as appropriate for your environment.

## Troubleshooting

#### Failure to obtain a certificate

There are two common reasons why the `certbot` process fails:

1. LetsEncrypt requires a short communication with the machine requesting the certificate over port 80. If port 80 is firewalled off this exchange will fail, and a certificate will not be issued.  Ensure traffic on port 80 is open.
2. LetsEncrypt requires _proof you control the domain_, so attempts to obtain certificates for domains you do not
control may be rejected.
 
#### Grafana starts, but HTTPS unavailable

In the process of configuring HTTPS, the following are common errors you may encounter in Grafana's
logs, and how to resolve them.

```
level=error msg="Stopped background service" service=*api.HTTPServer reason="open /etc/grafana/grafana.crt: permission denied"
```

Cryptographic keys and certificates should be kept with file permissions as restricted as possible; but if
the Grafana process cannot access the file, HTTPS cannot be properly set up.  Double check file permissions
according to the guide steps above and try again.

```
listen tcp 34.148.30.243:3000: bind: cannot assign requested address
```

This can occur when `http_addr` in the config to be your server's address.  This setting is for specifying the network interface or address the grafana process binds to, not about the end serving URL.  Make sure `http_addr` is blank in your config to bind to all interfaces. In particular, if you set `http_addr: subdomain.mysite.com` and
layers such as Network Address Translation (NAT) are in place, this will result in Grafana being unable to bind to
the external address.