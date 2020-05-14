FROM debian:buster-slim 
USER root 
ADD scripts scripts
ADD install /usr/local/bin
RUN cd scripts && ./deploy.sh
