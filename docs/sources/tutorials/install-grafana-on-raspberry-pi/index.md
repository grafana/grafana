---
title: Install Grafana on Raspberry Pi
summary: Get Grafana set up on your Raspberry Pi.
description: Get Grafana set up on your Raspberry Pi.
id: install-grafana-on-raspberry-pi
categories: ['administration']
tags: ['beginner']
authors: ['grafana_labs']
Feedback Link: https://github.com/grafana/tutorials/issues/new
---

## Introduction

The Raspberry Pi is a tiny, affordable, yet capable computer that can run a range of different applications. Even Grafana!

Many people are running Grafana on Raspberry Pi as a way to monitor their home, for things like indoor temperature, humidity, or energy usage.

In this tutorial, you'll:

- Set up a Raspberry Pi using a version of Raspberry Pi OS (previously called "Raspbian") that does not require you to connect a keyboard or monitor (this is often called "headless").
- Install Grafana on your Raspberry Pi.

{{% class "prerequisite-section" %}}

### Prerequisites

- Raspberry Pi
- SD card
  {{% /class %}}

## Set up your Raspberry Pi

Before we can install Grafana, you first need to set up your Raspberry Pi.

For this tutorial, you'll configure your Raspberry Pi to be _headless_. This means you don't need to connect a monitor, keyboard, or mouse to your Raspberry Pi. All configuration is done from your regular computer.

#### Download and install Raspberry Pi Imager

Before we get started, you need to download and install the [Raspberry Pi Imager](https://www.raspberrypi.org/software/).

We'll use the Raspberry Pi Imager to flash the operating system image to the SD card. You download the imager directly from the official Raspberry Pi website and it's available for Ubuntu Linux, macOS, and Windows.

Follow the directions on the website to download and install the imager.

#### Install Raspberry Pi OS

Now it is time to install Raspberry Pi OS.

1. Insert the SD card into your regular computer from which you plan to install Raspberry Pi OS.
1. Run the Raspberry Pi Imager that you downloaded and installed.
1. To select an operating system, click **Choose OS** in the imager. You will be shown a list of available options.
1. From the list, select **Raspberry Pi OS (other)** and then select **Raspberry Pi OS Lite**, which is a Debian-based operating system for the Raspberry Pi. Since you're going to run a headless Raspberry Pi, you won't need the desktop dependencies.
1. To select where you want to put the operating system image, click **Choose Storage** in the imager and then select the SD card you already inserted into your computer.
1. The final step in the imager to click **Write**. When you do, the imager will write the Raspberry Pi OS Lite image to the SD card and verify that it has been written correctly.
1. Eject the SD card from your computer, and insert it again.

While you _could_ fire up the Raspberry Pi now, we don't yet have any way of accessing it.

1. Create an empty file called `ssh` in the boot directory. This enables SSH so that you can log in remotely.

   The next step is only required if you want the Raspberry Pi to connect to your wireless network. Otherwise, connect the it to your network by using a network cable.

1. **(Optional)** Create a file called `wpa_supplicant.conf` in the boot directory:

   ```
   ctrl_interface=/var/run/wpa_supplicant
   update_config=1
   country=<Insert 2 letter ISO 3166-1 country code here>

   network={
    ssid="<Name of your WiFi>"
    psk="<Password for your WiFi>"
   }
   ```

All the necessary files are now on the SD card. Let's start up the Raspberry Pi.

1. Eject the SD card and insert it into the SD card slot on the Raspberry Pi.
1. Connect the power cable and make sure the LED lights are on.
1. Find the IP address of the Raspberry Pi. Usually you can find the address in the control panel for your WiFi router.

#### Connect remotely via SSH

1. Open up your terminal and enter the following command:
   ```
   ssh pi@<ip address>
   ```
1. SSH warns you that the authenticity of the host can't be established. Type "yes" to continue connecting.
1. When asked for a password, enter the default password: `raspberry`.
1. Once you're logged in, change the default password:
   ```
   passwd
   ```

Congratulations! You've now got a tiny Linux machine running that you can hide in a closet and access from your normal workstation.

## Install Grafana

Now that you've got the Raspberry Pi up and running, the next step is to install Grafana.

1. Add the APT key used to authenticate packages:

   ```
   wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
   ```

1. Add the Grafana APT repository:

   ```
   echo "deb https://packages.grafana.com/oss/deb stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list
   ```

1. Install Grafana:
   ```
   sudo apt-get update
   sudo apt-get install -y grafana
   ```

Grafana is now installed, but not yet running. To make sure Grafana starts up even if the Raspberry Pi is restarted, we need to enable and start the Grafana Systemctl service.

1. Enable the Grafana server:

   ```
   sudo /bin/systemctl enable grafana-server
   ```

1. Start the Grafana server:

   ```
   sudo /bin/systemctl start grafana-server
   ```

   Grafana is now running on the machine and is accessible from any device on the local network.

1. Open a browser and go to `http://<ip address>:3000`, where the IP address is the address that you used to connect to the Raspberry Pi earlier. You're greeted with the Grafana login page.
1. Log in to Grafana with the default username `admin`, and the default password `admin`.
1. Change the password for the admin user when asked.

Congratulations! Grafana is now running on your Raspberry Pi. If the Raspberry Pi is ever restarted or turned off, Grafana will start up whenever the machine regains power.

## Summary

If you want to use Grafana without having to go through a full installation process, check out [Grafana Cloud](/products/cloud/), which is designed to get users up and running quickly and easily. Grafana Cloud offers a forever free plan that is genuinely useful for hobbyists, testing, and small teams.

### Learn more

- [Raspberry Pi Documentation](https://www.raspberrypi.org/documentation/)
